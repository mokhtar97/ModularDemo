import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContentNode } from '../content/content.models';
import { indexTree, normalizePath, SiteService } from './site.service';
import { SITE_ROOT_KEY } from './site.config';

const node = (
  name: string,
  url: string,
  sortOrder: number,
  props: Record<string, string> = {},
  children: ContentNode[] | null = [],
): ContentNode => ({
  id: sortOrder,
  key: crypto.randomUUID(),
  name,
  contentType: 'page',
  url,
  level: 1,
  sortOrder,
  createDate: '',
  updateDate: '',
  properties: props,
  children,
});

// Mirrors the real API output: children are NOT under the root URL (HideTopLevelNodeFromPath).
const zooTree = () =>
  node('Home Page Zoo', '/home-page-zoo/', 3, { pageTitle: 'Zoo Project', heroText: 'Welcome' }, [
    node('Contact Zoo', '/contact-zoo/', 1),
    node('About Zoo', '/about-zoo/', 0),
  ]);

describe('site path indexing', () => {
  it('indexes the real tree shape', () => {
    expect([...indexTree(zooTree()).keys()]).toEqual(['', 'contact-zoo', 'about-zoo']);
  });

  it('strips the root URL when children live under it', () => {
    const tree = node('Root', '/root/', 0, {}, [
      node('Child', '/root/child/', 0, {}, [node('Deep', '/root/child/deep/', 0)]),
    ]);
    expect([...indexTree(tree).keys()]).toEqual(['', 'child', 'child/deep']);
  });

  it('falls back to a slug of the name for "#" or empty URLs, and uses the pathname of absolute URLs', () => {
    const tree = node('Root', '/', 0, {}, [
      node('Unrouted Café Page', '#', 0),
      node('Abs', 'https://example.com/abs/', 1),
    ]);
    expect([...indexTree(tree).keys()]).toEqual(['', 'unrouted-cafe-page', 'abs']);
  });

  it('normalizes query, hash, slashes and case', () => {
    expect(normalizePath('/About-Zoo/?x=1#top')).toBe('about-zoo');
    expect(normalizePath('/')).toBe('');
  });
});

describe('SiteService', () => {
  let service: SiteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SiteService);
    http = TestBed.inject(HttpTestingController);
  });

  it('loads the root by key once and exposes site name, nav and lookup', () => {
    service.load();
    service.load(); // no second request while loading
    http.expectOne(`/api/content/nodes/${SITE_ROOT_KEY}?depth=3`).flush(zooTree());

    expect(service.siteName()).toBe('Zoo Project');
    expect(service.nav()).toEqual([
      { label: 'Home', path: '/' },
      { label: 'About Zoo', path: '/about-zoo' },
      { label: 'Contact Zoo', path: '/contact-zoo' },
    ]);
    expect(service.findByPath('/ABOUT-ZOO/')?.node.name).toBe('About Zoo');
    expect(service.findByPath('/missing')).toBeNull();
  });

  it('reports a specific error for 404 and allows retrying', () => {
    service.load();
    http.expectOne(() => true).flush(null, { status: 404, statusText: 'Not Found' });
    expect(service.error()).toContain("wasn't found");

    service.load();
    http.expectOne(() => true).flush(zooTree());
    expect(service.error()).toBeNull();
    expect(service.root()?.name).toBe('Home Page Zoo');
  });

  it('reports an unreachable site for network and proxy errors', () => {
    service.load();
    http.expectOne(() => true).error(new ProgressEvent('error'));
    expect(service.error()).toContain("Couldn't reach");
  });
});

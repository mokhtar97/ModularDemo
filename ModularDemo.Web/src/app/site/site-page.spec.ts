import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SitePage } from './site-page';
import { SITE_ROOT_KEY } from './site.config';

const home = (properties: Record<string, unknown>) => ({
  id: 1071,
  key: SITE_ROOT_KEY,
  name: 'Home Page Zoo',
  contentType: 'home',
  url: '/en/',
  level: 1,
  sortOrder: 0,
  createDate: '',
  updateDate: '',
  properties,
  children: [],
});

describe('SitePage', () => {
  function renderHome(properties: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({
      imports: [SitePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(SitePage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/content/nodes/${SITE_ROOT_KEY}?depth=3`)
      .flush(home(properties));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders properties in the order the API returns them', () => {
    const el = renderHome({
      stream: '<p>Stream embed</p>',
      pageTitle: 'Welcome to the Garden',
      image: { id: 1, key: 'img', name: 'Zoo', contentType: 'Image', url: '/media/zoo.jpg' },
      heroText: 'First paragraph.\n\nSecond paragraph.',
      video: null,
    });

    const order = [...el.querySelector('article')!.children].map((child) =>
      child.tagName === 'H1'
        ? 'title'
        : child.querySelector('img')
          ? 'image'
          : child.querySelector('.rte')
            ? 'rte'
            : child.querySelector('.text')
              ? 'text'
              : child.tagName,
    );
    expect(order).toEqual(['rte', 'title', 'image', 'text']); // empty "video" is skipped
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Welcome to the Garden');
  });

  it('puts the heading first when the page has no pageTitle property', () => {
    const el = renderHome({ heroText: 'Hello' });
    expect(el.querySelector('article')!.firstElementChild?.tagName).toBe('H1');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Home Page Zoo');
  });
});

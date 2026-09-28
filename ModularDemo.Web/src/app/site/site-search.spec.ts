import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { SiteSearch } from './site-search';
import { SiteService } from './site.service';
import { SITE_ROOT_KEY } from './site.config';

const LION_KEY = '057a8c6e-6c88-4c25-93f9-d80cfbd9489e';

const tree = {
  id: 1071,
  key: SITE_ROOT_KEY,
  name: 'Home Page Zoo',
  contentType: 'home',
  url: '/en/',
  level: 1,
  sortOrder: 0,
  createDate: '',
  updateDate: '',
  properties: {},
  children: [
    {
      id: 1079,
      key: 'products-key',
      name: 'product',
      contentType: 'products',
      url: '/en/product/',
      level: 2,
      sortOrder: 0,
      createDate: '',
      updateDate: '',
      properties: {},
      children: [
        {
          id: 1080,
          key: LION_KEY,
          name: 'lion animal',
          contentType: 'product',
          url: '/en/product/lion-animal/',
          level: 3,
          sortOrder: 0,
          createDate: '',
          updateDate: '',
          properties: {},
          children: [],
        },
      ],
    },
  ],
};

describe('SiteSearch', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [SiteSearch],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);

    const site = TestBed.inject(SiteService);
    site.load();
    http.expectOne(`/api/content/nodes/${SITE_ROOT_KEY}?depth=3`).flush(tree);
  });

  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(SiteSearch);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = el.querySelector('button.trigger') as HTMLButtonElement;
    const panel = () => el.querySelector('[role="dialog"]');
    const input = () => el.querySelector('[role="dialog"] input') as HTMLInputElement;
    const openPanel = () => {
      trigger.click();
      fixture.detectChanges();
      TestBed.tick();
    };
    const type = (value: string) => {
      if (!panel()) openPanel();
      input().value = value;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
      TestBed.tick();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
    };
    return { fixture, el, trigger, panel, input, openPanel, type };
  }

  it('shows only a compact button in the header until opened', () => {
    const { el, panel, openPanel, input } = setup();
    expect(el.querySelector('button.trigger')).toBeTruthy();
    expect(panel()).toBeNull();

    openPanel();
    expect(panel()).toBeTruthy();
    expect(document.activeElement).toBe(input());
  });

  it('opens with Ctrl+K and closes with Escape, returning focus to the button', () => {
    const { fixture, panel, trigger } = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    fixture.detectChanges();
    expect(panel()).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('searches this site after a pause and shows hits mapped to Angular routes', () => {
    const { fixture, type } = setup();
    type('lio');

    http.expectOne(`/api/search?q=lio&take=8&root=${SITE_ROOT_KEY}`).flush([
      {
        key: LION_KEY,
        name: 'lion animal',
        url: '/en/product/lion-animal/',
        contentType: 'product',
        excerpt: 'lion power',
      },
      { key: 'not-in-tree', name: 'Elsewhere', url: '/x/', contentType: 'page', excerpt: null },
    ]);
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('li[role="option"]');
    expect(options.length).toBe(1); // the hit outside the loaded tree is dropped
    expect(options[0].textContent).toContain('lion animal');
    expect(options[0].textContent).toContain('lion power');
  });

  it('does not search for fewer than two characters', () => {
    const { type } = setup();
    type('l');
    http.expectNone((req) => req.url.startsWith('/api/search'));
  });

  it('opens the first hit on Enter and closes the panel', () => {
    const { fixture, input, panel, type } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    type('lion');
    http
      .expectOne((req) => req.url.startsWith('/api/search'))
      .flush([
        { key: LION_KEY, name: 'lion animal', url: '', contentType: 'product', excerpt: null },
      ]);
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith('/product/lion-animal');
    expect(panel()).toBeNull();
  });

  it('shows "No results" when nothing matches', () => {
    const { fixture, type } = setup();
    type('zebra');
    http.expectOne((req) => req.url.startsWith('/api/search')).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.note')?.textContent).toContain('No results');
  });
});

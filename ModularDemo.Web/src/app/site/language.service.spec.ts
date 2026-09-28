import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Language } from '../content/content.models';
import { isRtl, LanguageService } from './language.service';
import { SiteService } from './site.service';
import { SITE_ROOT_KEY } from './site.config';

const languages: Language[] = [
  { isoCode: 'en-US', name: 'English (United States)', isDefault: true, fallbackIsoCode: null },
  { isoCode: 'ar', name: 'Arabic', isDefault: false, fallbackIsoCode: 'en-US' },
];

const root = (name: string) => ({
  id: 1,
  key: SITE_ROOT_KEY,
  name,
  contentType: 'home',
  url: '/',
  level: 1,
  sortOrder: 0,
  createDate: '',
  updateDate: '',
  properties: {},
  children: [],
});

describe('LanguageService', () => {
  let lang: LanguageService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    lang = TestBed.inject(LanguageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  it('resolves the default language once the list loads and translates with fallbacks', () => {
    lang.load();
    http.expectOne('/api/content/languages').flush(languages);
    http.expectOne('/api/content/dictionary').flush({ 'Nav.Home': 'Home page' });

    expect(lang.current()).toBe('en-US');
    expect(lang.t('Nav.Home', 'Home')).toBe('Home page');
    expect(lang.t('Missing.Key', 'Fallback')).toBe('Fallback');
    expect(lang.same(null, 'EN-us')).toBe(true);
  });

  it('switches culture, remembers it, loads its dictionary and sets <html lang dir>', () => {
    lang.load();
    http.expectOne('/api/content/languages').flush(languages);
    http.expectOne('/api/content/dictionary').flush({});

    lang.use('ar');
    http.expectOne('/api/content/dictionary?culture=ar').flush({ 'Nav.Home': 'الرئيسية' });
    TestBed.tick();

    const html = TestBed.inject(DOCUMENT).documentElement;
    expect(lang.current()).toBe('ar');
    expect(lang.t('Nav.Home', 'Home')).toBe('الرئيسية');
    expect(localStorage.getItem('zoo.culture')).toBe('ar');
    expect(html.lang).toBe('ar');
    expect(html.dir).toBe('rtl');
  });

  it('falls back to the default language when the stored culture no longer exists', () => {
    localStorage.setItem('zoo.culture', 'fr');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fresh = TestBed.inject(LanguageService);
    const freshHttp = TestBed.inject(HttpTestingController);

    expect(fresh.current()).toBe('fr'); // before the list arrives
    fresh.load();
    freshHttp.expectOne('/api/content/languages').flush(languages);
    freshHttp.expectOne('/api/content/dictionary?culture=fr').flush({});
    expect(fresh.current()).toBe('en-US');
  });

  it('detects right-to-left languages', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('ar-EG')).toBe(true);
    expect(isRtl('en-US')).toBe(false);
    expect(isRtl(null)).toBe(false);
  });
});

describe('SiteService with languages', () => {
  it('reloads the tree in the new culture and not again for the same one', () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const site = TestBed.inject(SiteService);
    const lang = TestBed.inject(LanguageService);
    const http = TestBed.inject(HttpTestingController);

    lang.load();
    site.load();
    http.expectOne(`/api/content/nodes/${SITE_ROOT_KEY}?depth=3`).flush(root('Zoo'));
    http.expectOne('/api/content/languages').flush(languages);
    http.expectOne('/api/content/dictionary').flush({});

    site.load(); // default tree already loaded -> no request
    http.expectNone(() => true);

    lang.use('ar');
    http.expectOne('/api/content/dictionary?culture=ar').flush({});
    site.load();
    expect(site.loading()).toBe(true);
    expect(site.root()?.name).toBe('Zoo'); // old tree stays until the new one arrives
    http.expectOne(`/api/content/nodes/${SITE_ROOT_KEY}?depth=3&culture=ar`).flush(root('حديقة'));

    expect(site.root()?.name).toBe('حديقة');
    expect(site.pathOfKey(SITE_ROOT_KEY)).toBe('/');
    http.verify();
    localStorage.clear();
  });
});

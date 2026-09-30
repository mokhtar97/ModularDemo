import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PretixService } from './pretix.service';

describe('PretixService', () => {
  let service: PretixService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PretixService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls the Umbraco proxy endpoints, never pretix directly', () => {
    service.events('ar').subscribe();
    service.event('summer 2026', 'en-US').subscribe();
    service.items('summer-2026').subscribe();
    service.quotas('summer-2026').subscribe();
    http.expectOne('/api/pretix/events?culture=ar').flush([]);
    http.expectOne('/api/pretix/events/summer%202026?culture=en-US').flush({});
    http.expectOne('/api/pretix/events/summer-2026/items').flush([]);
    http.expectOne('/api/pretix/events/summer-2026/quotas').flush([]);
  });

  it('loads the settings once and shares them', () => {
    service.settings().subscribe();
    service.settings().subscribe();
    http
      .expectOne('/api/pretix/settings')
      .flush({ baseUrl: 'http://p/', organizer: 'o', widgetVersion: 'v1' });
    let second: unknown;
    service.settings().subscribe((s) => (second = s));
    expect(second).toEqual({ baseUrl: 'http://p/', organizer: 'o', widgetVersion: 'v1' });
  });

  it('shares one items/quotas request between components', () => {
    service.items('eelxc', 'ar').subscribe();
    service.items('eelxc', 'ar').subscribe();
    service.quotas('eelxc').subscribe();
    service.quotas('eelxc').subscribe();
    http.expectOne('/api/pretix/events/eelxc/items?culture=ar').flush([]);
    http.expectOne('/api/pretix/events/eelxc/quotas').flush([]);
  });

  it('does not keep a failed request', () => {
    service.items('eelxc').subscribe({ error: () => undefined });
    http
      .expectOne('/api/pretix/events/eelxc/items')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    service.items('eelxc').subscribe();
    http.expectOne('/api/pretix/events/eelxc/items').flush([]);
  });
});

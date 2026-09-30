import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UpcomingEvents } from './upcoming-events';
import { SiteService } from '../site/site.service';
import { SITE_ROOT_KEY } from '../site/site.config';

const node = (
  key: string,
  name: string,
  type: string,
  url: string,
  props = {},
  children: unknown[] = [],
) => ({
  id: 1,
  key,
  name,
  contentType: type,
  url,
  level: 1,
  sortOrder: 0,
  createDate: '',
  updateDate: '',
  properties: props,
  children,
});

const event = (slug: string, name: string, live = true, testMode = false) => ({
  slug,
  name,
  live,
  testMode,
  dateFrom: '2026-10-05T18:00:00+02:00',
  dateTo: null,
  dateAdmission: null,
  location: 'Main hall',
  currency: 'EUR',
  hasSubevents: false,
  presaleStart: null,
  presaleEnd: null,
  shopUrl: `http://localhost:8345/myorg/${slug}/`,
});

describe('UpcomingEvents', () => {
  it('links to the Umbraco page for an event, else to its automatic page under the events list', () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [UpcomingEvents],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(SiteService).load();
    http
      .expectOne(`/api/content/nodes/${SITE_ROOT_KEY}?depth=3`)
      .flush(
        node(SITE_ROOT_KEY, 'Home', 'home', '/en/', {}, [
          node('events', 'Events', 'events', '/en/events/', {}, [
            node('gala', 'Gala night', 'event', '/en/events/gala/', { pretixEvent: 'gala' }),
          ]),
        ]),
      );

    const fixture = TestBed.createComponent(UpcomingEvents);
    fixture.detectChanges();
    TestBed.tick();
    http
      .expectOne('/api/pretix/events')
      .flush([event('gala', 'Gala'), event('expo', 'Expo', false, true)]);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li.event');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('h3').textContent.trim()).toBe('Gala');
    expect(items[0].querySelector('a.cta').getAttribute('href')).toBe('/events/gala');
    expect(items[1].querySelector('a.cta').getAttribute('href')).toBe('/events/expo');
    expect(items[0].querySelector('.badge')).toBeNull(); // live, not in test mode
    expect(
      [...items[1].querySelectorAll('.badge')].map((b: Element) => b.textContent?.trim()),
    ).toEqual(['Not live', 'Test mode']);
  });

  it('shows an error message when pretix is unavailable', () => {
    TestBed.configureTestingModule({
      imports: [UpcomingEvents],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UpcomingEvents);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/pretix/events').flush(null, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { PretixEventPage } from './pretix-event-page';
import { PretixWidgetLoader } from './pretix-widget-loader';

const event = {
  slug: 'eelxc',
  name: 'Garden Night',
  live: false,
  testMode: true,
  dateFrom: '2026-10-09T16:00:00Z',
  dateTo: '2026-10-09T19:00:00Z',
  dateAdmission: null,
  location: 'Open-air stage',
  currency: 'EUR',
  hasSubevents: false,
  presaleStart: null,
  presaleEnd: null,
  shopUrl: 'http://localhost:8345/lumin/eelxc/',
};

const quota = (available: boolean) => ({
  id: 1,
  name: 'All',
  size: 100,
  available,
  availableNumber: available ? 80 : 0,
  itemIds: [1, 2],
  variationIds: [],
});

const item = (id: number, price: number) => ({
  id,
  name: `Ticket ${id}`,
  description: null,
  price,
  currency: 'EUR',
  admission: true,
  variations: [],
});

describe('PretixEventPage', () => {
  function setup() {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PretixEventPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PretixWidgetLoader,
          useValue: {
            loadStyles() {},
            loadScript: () => Promise.resolve(),
            build: () => Promise.resolve(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(PretixEventPage);
    fixture.componentRef.setInput('slug', 'eelxc');
    fixture.componentRef.setInput('backPath', '/events');
    fixture.detectChanges();
    TestBed.tick();
    const http = TestBed.inject(HttpTestingController);
    const render = () => {
      fixture.detectChanges();
      TestBed.tick();
    };
    return { fixture, http, render, el: fixture.nativeElement as HTMLElement };
  }

  const badges = (el: HTMLElement) =>
    [...el.querySelectorAll('.badge')].map((b) => b.textContent?.trim());

  it('builds the page from pretix: name, badges, facts, lowest price and the widget', () => {
    const { http, render, el } = setup();
    http.expectOne('/api/pretix/events/eelxc').flush(event);
    http.expectOne('/api/pretix/events/eelxc/items').flush([item(1, 35), item(2, 29), item(3, 0)]);
    http.expectOne('/api/pretix/events/eelxc/quotas').flush([quota(true)]);
    render(); // renders the widget, which then asks for the pretix settings
    http
      .expectOne('/api/pretix/settings')
      .flush({ baseUrl: 'http://localhost:8345/', organizer: 'lumin', widgetVersion: 'v1' });
    render();

    expect(el.querySelector('h1')?.textContent).toBe('Garden Night');
    expect(badges(el)).toEqual(['Not live', 'Test mode']);
    expect(el.querySelector('.facts')?.textContent).toContain('Open-air stage');
    expect(el.querySelector('.facts')?.textContent).toContain('From €29.00'); // the free ticket doesn't make it 'From €0'
    expect(el.querySelector('a.back')?.getAttribute('href')).toBe('/events');
    expect(el.querySelector('pretix-widget')?.getAttribute('event')).toBe(
      'http://localhost:8345/lumin/eelxc/',
    );
    expect(TestBed.inject(Title).getTitle()).toContain('Garden Night');
  });

  it('still shows the event when prices fail, and marks sold out', () => {
    const { http, render, el } = setup();
    http.expectOne('/api/pretix/events/eelxc').flush({ ...event, live: true, testMode: false });
    http
      .expectOne('/api/pretix/events/eelxc/items')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    http.expectOne('/api/pretix/events/eelxc/quotas').flush([quota(false)]);
    render();

    expect(el.querySelector('h1')?.textContent).toBe('Garden Night');
    expect(badges(el)).toEqual(['Sold out']);
    expect(el.querySelector('.facts')?.textContent).not.toContain('From');
  });

  it('shows "Event not found" for an unknown slug', () => {
    const { http, render, el } = setup();
    // A 404 on the event cancels the items/quotas requests (forkJoin), so only answer this one.
    http
      .expectOne('/api/pretix/events/eelxc')
      .flush(null, { status: 404, statusText: 'Not Found' });
    render();
    expect(el.querySelector('h1')?.textContent).toContain('Event not found');
  });
});

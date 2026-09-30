import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PretixProducts } from './pretix-products';

const quota = (
  id: number,
  itemIds: number[],
  available: boolean,
  availableNumber: number | null,
  variationIds: number[] = [],
) => ({
  id,
  name: `Q${id}`,
  size: 100,
  available,
  availableNumber,
  itemIds,
  variationIds,
});

describe('PretixProducts', () => {
  function setup() {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PretixProducts],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PretixProducts);
    fixture.componentRef.setInput('event', 'eelxc');
    fixture.detectChanges();
    TestBed.tick();
    return {
      fixture,
      http: TestBed.inject(HttpTestingController),
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('lists products with prices, variations and availability', () => {
    const { fixture, http, el } = setup();
    http.expectOne('/api/pretix/events/eelxc/items').flush([
      {
        id: 1,
        name: 'Regular ticket',
        description: '**Entry** for one adult',
        price: 35,
        currency: 'EUR',
        admission: true,
        variations: [],
      },
      {
        id: 2,
        name: 'Reduced ticket',
        description: null,
        price: 29,
        currency: 'EUR',
        admission: true,
        variations: [],
      },
      {
        id: 3,
        name: 'Workshop',
        description: null,
        price: 10,
        currency: 'EUR',
        admission: false,
        variations: [
          { id: 31, name: 'Morning', price: 10 },
          { id: 32, name: 'Evening', price: 12 },
        ],
      },
      {
        id: 4,
        name: 'Child',
        description: null,
        price: 0,
        currency: 'EUR',
        admission: true,
        variations: [],
      },
    ]);
    http.expectOne('/api/pretix/events/eelxc/quotas').flush([
      quota(1, [1], true, 80),
      quota(2, [2], false, 0),
      quota(3, [3], true, 4, [31]),
      quota(4, [3], true, null, [32]), // unlimited
    ]);
    fixture.detectChanges();

    const products = [...el.querySelectorAll('li.product')];
    expect(products.map((p) => p.querySelector('h3')?.textContent)).toEqual([
      'Regular ticket',
      'Reduced ticket',
      'Workshop',
      'Child',
    ]);
    expect(products[0].querySelector('.description')?.textContent).toBe('Entry for one adult');
    expect(products[0].querySelector('.price')?.textContent).toBe('€35.00');
    expect(products[0].querySelector('.badge')).toBeNull(); // 80 left: no badge
    expect(products[1].querySelector('.badge')?.textContent?.trim()).toBe('Sold out');
    const workshop = [...products[2].querySelectorAll('.prices li')].map((li) =>
      [...li.querySelectorAll('span')].map((part) => part.textContent?.trim()).join(' '),
    );
    expect(workshop).toEqual(['Morning €10.00 Only 4 left', 'Evening €12.00']);
    expect(products[3].querySelector('.price')?.textContent).toBe('Free');
  });

  it('still shows prices when availability fails, and a message when products fail', () => {
    const first = setup();
    first.http.expectOne('/api/pretix/events/eelxc/items').flush([
      {
        id: 1,
        name: 'Regular',
        description: null,
        price: 35,
        currency: 'EUR',
        admission: true,
        variations: [],
      },
    ]);
    first.http
      .expectOne('/api/pretix/events/eelxc/quotas')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    first.fixture.detectChanges();
    expect(first.el.querySelector('.price')?.textContent).toBe('€35.00');
  });

  it('shows a message when there are no products', () => {
    const { fixture, http, el } = setup();
    http.expectOne('/api/pretix/events/eelxc/items').flush([]);
    http.expectOne('/api/pretix/events/eelxc/quotas').flush([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No tickets are on sale yet.');
  });
});

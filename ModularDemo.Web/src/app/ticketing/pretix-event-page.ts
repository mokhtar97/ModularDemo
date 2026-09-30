import { Component, computed, effect, inject, input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { LanguageService } from '../site/language.service';
import { SiteService } from '../site/site.service';
import { PretixWidget } from './pretix-widget';
import { PretixProducts } from './pretix-products';
import { PretixEvent, PretixItem, PretixQuota } from './pretix.models';
import { PretixService } from './pretix.service';

type State =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; event: PretixEvent; items: PretixItem[]; quotas: PretixQuota[] };

/**
 * A page generated from pretix for one event — no Umbraco item needed. Shown by SitePage for
 * "<events page>/<event slug>". Loads the event, its products (for the "from" price) and quotas
 * (for "sold out") in the current language, then embeds the ticket shop.
 */
@Component({
  selector: 'app-pretix-event-page',
  imports: [RouterLink, PretixWidget, PretixProducts],
  template: `
    @switch (state().status) {
      @case ('loading') {
        <p class="status" role="status">{{ lang.t('Site.Loading', 'Loading…') }}</p>
      }
      @case ('notFound') {
        <section class="status">
          <h1>{{ lang.t('Tickets.NotFound', 'Event not found') }}</h1>
          <p>
            <code dir="ltr">{{ slug() }}</code>
          </p>
          @if (backPath(); as back) {
            <a [routerLink]="back">{{ lang.t('Tickets.AllEvents', 'All events') }}</a>
          }
        </section>
      }
      @case ('error') {
        <section class="status" role="alert">
          <h1>
            {{ lang.t('Tickets.Unavailable', 'The ticket shop is not available right now.') }}
          </h1>
          @if (backPath(); as back) {
            <a [routerLink]="back">{{ lang.t('Tickets.AllEvents', 'All events') }}</a>
          }
        </section>
      }
      @default {
        @if (view(); as v) {
          <article class="event-page">
            @if (backPath(); as back) {
              <a class="back" [routerLink]="back">{{
                lang.t('Tickets.AllEvents', 'All events')
              }}</a>
            }

            <header>
              <h1>{{ v.event.name }}</h1>
              <div class="badges">
                @if (v.soldOut) {
                  <span class="badge sold">{{ lang.t('Tickets.SoldOut', 'Sold out') }}</span>
                }
                @if (!v.event.live) {
                  <span class="badge off">{{ lang.t('Tickets.NotLive', 'Not live') }}</span>
                }
                @if (v.event.testMode) {
                  <span class="badge test">{{ lang.t('Tickets.TestMode', 'Test mode') }}</span>
                }
              </div>
            </header>

            <dl class="facts">
              @if (v.when) {
                <div>
                  <dt>{{ lang.t('Tickets.When', 'When') }}</dt>
                  <dd>{{ v.when }}</dd>
                </div>
              }
              @if (v.admission) {
                <div>
                  <dt>{{ lang.t('Tickets.Admission', 'Admission') }}</dt>
                  <dd>{{ v.admission }}</dd>
                </div>
              }
              @if (v.event.location) {
                <div>
                  <dt>{{ lang.t('Tickets.Where', 'Where') }}</dt>
                  <dd>{{ v.event.location }}</dd>
                </div>
              }
              @if (v.fromPrice) {
                <div>
                  <dt>{{ lang.t('Tickets.Price', 'Price') }}</dt>
                  <dd>
                    @if (v.fromPrice === 'free') {
                      {{ lang.t('Tickets.Free', 'Free') }}
                    } @else {
                      {{ lang.t('Tickets.From', 'From') }} {{ v.fromPrice }}
                    }
                  </dd>
                </div>
              }
            </dl>

            <section class="products-section" aria-labelledby="event-products-title">
              <h2 id="event-products-title">{{ lang.t('Tickets.Products', 'Ticket types') }}</h2>
              <app-pretix-products [event]="v.event.slug" />
            </section>

            <section class="tickets" aria-labelledby="event-tickets-title">
              <h2 id="event-tickets-title">{{ lang.t('Tickets.Title', 'Tickets') }}</h2>
              <app-pretix-widget [event]="v.event.slug" />
            </section>
          </article>
        }
      }
    }
  `,
  styles: `
    .event-page {
      display: grid;
      gap: 1.5rem;
    }
    .back {
      justify-self: start;
      font-weight: 600;
      text-decoration: none;
    }
    .back::before {
      content: '← ';
    }
    :host-context([dir='rtl']) .back::before {
      content: '→ ';
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      padding-bottom: 0.6rem;
      border-bottom: 3px solid var(--accent);
    }
    h1 {
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      line-height: 1.25;
      color: var(--heading);
    }
    .badges {
      display: flex;
      gap: 0.4rem;
    }
    .badge {
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.off,
    .badge.sold {
      background: #fde2e1;
      color: #9b1c1c;
    }
    .badge.test {
      background: var(--accent-soft);
      color: #7a5a00;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
      margin: 0;
    }
    .facts div {
      padding: 0.8rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    dt {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
    }
    dd {
      margin: 0.2rem 0 0;
      font-weight: 600;
    }
    .products-section h2,
    .tickets h2 {
      margin: 0 0 0.75rem;
      font-size: 1.4rem;
      color: var(--heading);
    }
    .status {
      padding: 2rem 0;
    }
  `,
})
export class PretixEventPage {
  private readonly pretix = inject(PretixService);
  private readonly site = inject(SiteService);
  protected readonly lang = inject(LanguageService);

  /** pretix event slug, e.g. "eelxc". */
  readonly slug = input.required<string>();
  /** Route of the events list page, for the "All events" link. */
  readonly backPath = input<string | null>(null);

  protected readonly state = toSignal(
    combineLatest([toObservable(this.slug), toObservable(this.lang.current)]).pipe(
      switchMap(([slug, culture]) =>
        forkJoin({
          event: this.pretix.event(slug, culture),
          // Prices and availability are extras: the page still works without them.
          items: this.pretix.items(slug, culture).pipe(catchError(() => of([] as PretixItem[]))),
          quotas: this.pretix.quotas(slug).pipe(catchError(() => of([] as PretixQuota[]))),
        }).pipe(
          map((data): State => ({ status: 'ready', ...data })),
          catchError((err: unknown) =>
            of<State>({
              status: err instanceof HttpErrorResponse && err.status === 404 ? 'notFound' : 'error',
            }),
          ),
          startWith<State>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as State },
  );

  protected readonly view = computed(() => {
    const state = this.state();
    if (state.status !== 'ready') return null;
    const { event, items, quotas } = state;
    const culture = this.lang.current() ?? undefined;
    return {
      event,
      when: formatRange(event.dateFrom, event.dateTo, culture),
      admission: event.dateAdmission
        ? new Intl.DateTimeFormat(culture, { timeStyle: 'short' }).format(
            new Date(event.dateAdmission),
          )
        : null,
      fromPrice: lowestPrice(items, event.currency, culture),
      // Sold out = every quota reports no availability (unlimited quotas report available).
      soldOut: quotas.length > 0 && quotas.every((q) => q.available === false),
    };
  });

  constructor() {
    const title = inject(Title);
    effect(() => {
      const name = this.view()?.event.name;
      const siteName = this.site.siteName();
      if (name) title.setTitle(siteName ? `${name} | ${siteName}` : name);
    });
  }
}

/** "Friday, 9 October 2026, 19:00 – 22:00", or two full dates when it spans several days. */
function formatRange(from: string | null, to: string | null, culture?: string): string | null {
  if (!from) return null;
  const start = new Date(from);
  const full = new Intl.DateTimeFormat(culture, { dateStyle: 'full', timeStyle: 'short' });
  if (!to) return full.format(start);
  const end = new Date(to);
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay
    ? `${full.format(start)} – ${new Intl.DateTimeFormat(culture, { timeStyle: 'short' }).format(end)}`
    : `${full.format(start)} – ${full.format(end)}`;
}

/** Lowest paid price over all products and variations in the event currency; 'free' if all are free. */
function lowestPrice(
  items: PretixItem[],
  currency: string | null,
  culture?: string,
): string | null {
  const prices = items
    .flatMap((i) => (i.variations.length ? i.variations.map((v) => v.price) : [i.price]))
    .filter((p): p is number => typeof p === 'number');
  if (!prices.length) return null;
  // Lowest *paid* price ("From €29"); free tickets alongside paid ones don't make it "From €0".
  const paid = prices.filter((p) => p > 0);
  if (!paid.length) return 'free';
  const min = Math.min(...paid);
  try {
    return currency
      ? new Intl.NumberFormat(culture, { style: 'currency', currency }).format(min)
      : new Intl.NumberFormat(culture).format(min);
  } catch {
    return String(min);
  }
}

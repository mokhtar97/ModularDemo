import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { LanguageService } from '../site/language.service';
import { PretixItem, PretixQuota } from './pretix.models';
import { PretixService } from './pretix.service';

/** Show "Only N left" at or below this many remaining tickets. */
const LOW_STOCK = 10;

type Availability = { kind: 'soldOut' } | { kind: 'low'; left: number } | null;

interface PriceLine {
  name: string | null; // variation name, or null for a product without variations
  price: string;
  availability: Availability;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  lines: PriceLine[];
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: PretixItem[]; quotas: PretixQuota[] };

/**
 * The products (ticket types) of a pretix event with prices, variations and availability,
 * in the current language. Buying happens in the pretix widget; this is the overview.
 *
 *   <app-pretix-products event="eelxc" />
 */
@Component({
  selector: 'app-pretix-products',
  template: `
    @switch (state().status) {
      @case ('loading') {
        <p class="note" role="status">{{ lang.t('Site.Loading', 'Loading…') }}</p>
      }
      @case ('error') {
        <p class="note">
          {{ lang.t('Tickets.ProductsError', "Ticket types couldn't be loaded.") }}
        </p>
      }
      @default {
        @if (rows().length) {
          <ul class="products">
            @for (row of rows(); track row.id) {
              <li class="product">
                <div class="info">
                  <h3>{{ row.name }}</h3>
                  @if (row.description) {
                    <p class="description">{{ row.description }}</p>
                  }
                </div>
                <ul class="prices">
                  @for (line of row.lines; track $index) {
                    <li [class.sold-out]="line.availability?.kind === 'soldOut'">
                      @if (line.name) {
                        <span class="variation">{{ line.name }}</span>
                      }
                      <span class="price">{{ line.price }}</span>
                      @switch (line.availability?.kind) {
                        @case ('soldOut') {
                          <span class="badge sold">{{
                            lang.t('Tickets.SoldOut', 'Sold out')
                          }}</span>
                        }
                        @case ('low') {
                          <span class="badge low">{{ leftText(line.availability) }}</span>
                        }
                      }
                    </li>
                  }
                </ul>
              </li>
            }
          </ul>
        } @else {
          <p class="note">{{ lang.t('Tickets.NoProducts', 'No tickets are on sale yet.') }}</p>
        }
      }
    }
  `,
  styles: `
    .products {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.6rem;
    }
    .product {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 0.5rem 1.5rem;
      padding: 0.9rem 1.1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    h3 {
      margin: 0;
      font-size: 1.05rem;
      color: var(--heading);
    }
    .description {
      margin: 0.25rem 0 0;
      font-size: 0.9rem;
      color: var(--muted);
      white-space: pre-line;
    }
    .prices {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.3rem;
      justify-items: end;
    }
    .prices li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .variation {
      font-size: 0.9rem;
      color: var(--muted);
    }
    .price {
      font-weight: 700;
      color: var(--heading);
      white-space: nowrap;
    }
    .sold-out .price {
      text-decoration: line-through;
      opacity: 0.6;
    }
    .badge {
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge.sold {
      background: #fde2e1;
      color: #9b1c1c;
    }
    .badge.low {
      background: var(--accent-soft);
      color: #7a5a00;
    }
    .note {
      color: var(--muted);
      margin: 0;
    }
    @media (max-width: 560px) {
      .product {
        grid-template-columns: 1fr;
      }
      .prices {
        justify-items: start;
      }
    }
  `,
})
export class PretixProducts {
  private readonly pretix = inject(PretixService);
  protected readonly lang = inject(LanguageService);

  /** pretix event slug. */
  readonly event = input.required<string>();

  protected readonly state = toSignal(
    combineLatest([toObservable(this.event), toObservable(this.lang.current)]).pipe(
      switchMap(([slug, culture]) =>
        forkJoin({
          items: this.pretix.items(slug, culture),
          // Availability is optional: without quotas the prices still show.
          quotas: this.pretix.quotas(slug).pipe(catchError(() => of([] as PretixQuota[]))),
        }).pipe(
          map((data): State => ({ status: 'ready', ...data })),
          catchError(() => of<State>({ status: 'error' })),
          startWith<State>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as State },
  );

  protected readonly rows = computed<ProductRow[]>(() => {
    const state = this.state();
    if (state.status !== 'ready') return [];
    const culture = this.lang.current() ?? undefined;
    const free = this.lang.t('Tickets.Free', 'Free');
    const format = (price: number | null, currency: string | null) =>
      formatPrice(price, currency, culture, free);

    return state.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: plainText(item.description),
      lines: item.variations.length
        ? item.variations.map((v) => ({
            name: v.name,
            price: format(v.price, item.currency),
            availability: availability(state.quotas, item.id, v.id),
          }))
        : [
            {
              name: null,
              price: format(item.price, item.currency),
              availability: availability(state.quotas, item.id),
            },
          ],
    }));
  });

  protected leftText(availability: Availability): string {
    const left = availability?.kind === 'low' ? availability.left : 0;
    return this.lang
      .t('Tickets.Left', 'Only {n} left')
      .replace('{n}', new Intl.NumberFormat(this.lang.current() ?? undefined).format(left));
  }
}

/**
 * pretix sells a product (or variation) only while every quota it belongs to has room, so:
 * any of its quotas unavailable → sold out; otherwise the smallest remaining number counts.
 * Unlimited quotas report availableNumber null. No quotas → unknown (no badge).
 */
function availability(quotas: PretixQuota[], itemId: number, variationId?: number): Availability {
  const relevant = quotas.filter(
    (q) =>
      q.itemIds.includes(itemId) &&
      (variationId === undefined || q.variationIds.includes(variationId)),
  );
  if (!relevant.length) return null;
  if (relevant.some((q) => q.available === false)) return { kind: 'soldOut' };
  const numbers = relevant
    .map((q) => q.availableNumber)
    .filter((n): n is number => typeof n === 'number');
  const left = numbers.length ? Math.min(...numbers) : null;
  return left !== null && left <= LOW_STOCK ? { kind: 'low', left } : null;
}

function formatPrice(
  price: number | null,
  currency: string | null,
  culture: string | undefined,
  free: string,
): string {
  if (price === null) return '—';
  if (price === 0) return free;
  try {
    return currency
      ? new Intl.NumberFormat(culture, { style: 'currency', currency }).format(price)
      : new Intl.NumberFormat(culture, { minimumFractionDigits: 2 }).format(price);
  } catch {
    return String(price);
  }
}

/** pretix descriptions may contain Markdown/HTML; show them as plain text. */
function plainText(text: string | null): string | null {
  if (!text) return null;
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return plain || null;
}

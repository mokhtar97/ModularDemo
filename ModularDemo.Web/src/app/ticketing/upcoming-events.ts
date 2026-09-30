import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { LanguageService } from '../site/language.service';
import { SiteService } from '../site/site.service';
import { PretixEvent } from './pretix.models';
import { PretixService } from './pretix.service';

/** Document type of the events list page (automatic event pages live below it). */
export const EVENTS_LIST_TYPE = 'events';

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: PretixEvent[] };

interface Row extends PretixEvent {
  /**
   * Where "Buy tickets" goes: an Umbraco page linked to this event (pretixEvent = slug) if one
   * exists, else the automatic page "<events page>/<slug>", else (no events page) the pretix shop.
   */
  pagePath: string | null;
  day: string;
  month: string;
  when: string;
}

/**
 * Upcoming pretix events (GET /api/pretix/events) in the current language. Each row links to
 * the Umbraco event page whose "pretixEvent" matches the event slug, or to the pretix shop.
 */
@Component({
  selector: 'app-upcoming-events',
  imports: [RouterLink],
  template: `
    <section class="upcoming" aria-labelledby="upcoming-title">
      <h2 id="upcoming-title">{{ lang.t('Tickets.Upcoming', 'Upcoming events') }}</h2>

      @switch (state().status) {
        @case ('loading') {
          <p class="note" role="status">{{ lang.t('Site.Loading', 'Loading…') }}</p>
        }
        @case ('error') {
          <p class="note" role="alert">
            {{ lang.t('Tickets.LoadError', "Events couldn't be loaded. Please try again later.") }}
          </p>
        }
        @default {
          @if (rows().length) {
            <ul class="list">
              @for (row of rows(); track row.slug) {
                <li class="event">
                  <div class="date" aria-hidden="true">
                    <span class="day">{{ row.day }}</span>
                    <span class="month">{{ row.month }}</span>
                  </div>
                  <div class="info">
                    <h3>
                      {{ row.name }}
                      @if (!row.live) {
                        <span class="badge off">{{ lang.t('Tickets.NotLive', 'Not live') }}</span>
                      }
                      @if (row.testMode) {
                        <span class="badge test">{{
                          lang.t('Tickets.TestMode', 'Test mode')
                        }}</span>
                      }
                    </h3>
                    <p class="meta">
                      {{ row.when }}
                      @if (row.location) {
                        · {{ row.location }}
                      }
                    </p>
                  </div>
                  @if (row.pagePath) {
                    <a class="cta" [routerLink]="row.pagePath">{{
                      lang.t('Tickets.Buy', 'Buy tickets')
                    }}</a>
                  } @else {
                    <a class="cta" [href]="row.shopUrl" target="_blank" rel="noopener">{{
                      lang.t('Tickets.Buy', 'Buy tickets')
                    }}</a>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="note">{{ lang.t('Tickets.NoEvents', 'No upcoming events right now.') }}</p>
          }
        }
      }
    </section>
  `,
  styles: `
    h2 {
      margin: 0 0 1rem;
      font-size: 1.4rem;
      color: var(--heading);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .event {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1rem;
      padding: 0.9rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
    }
    .date {
      display: grid;
      place-items: center;
      width: 3.6rem;
      height: 3.6rem;
      border-radius: 12px;
      background: var(--accent-soft);
      color: var(--heading);
      line-height: 1.1;
    }
    .day {
      font-size: 1.35rem;
      font-weight: 700;
    }
    .month {
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    h3 {
      margin: 0;
      font-size: 1.05rem;
      color: var(--heading);
    }
    .badge {
      display: inline-block;
      margin-inline-start: 0.4rem;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      vertical-align: middle;
    }
    .badge.off {
      background: #fde2e1;
      color: #9b1c1c;
    }
    .badge.test {
      background: var(--accent-soft);
      color: #7a5a00;
    }
    .meta {
      margin: 0.2rem 0 0;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .cta {
      padding: 0.5rem 1rem;
      border-radius: 999px;
      background: var(--brand);
      color: var(--on-brand);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .cta:hover {
      background: var(--brand-strong);
    }
    .note {
      color: var(--muted);
    }
    @media (max-width: 560px) {
      .event {
        grid-template-columns: auto 1fr;
      }
      .cta {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }
  `,
})
export class UpcomingEvents {
  private readonly pretix = inject(PretixService);
  private readonly site = inject(SiteService);
  protected readonly lang = inject(LanguageService);

  /** Reloads in the new language when the visitor switches. */
  protected readonly state = toSignal(
    toObservable(this.lang.current).pipe(
      switchMap((culture) =>
        this.pretix.events(culture).pipe(
          map((events): State => ({ status: 'ready', events })),
          catchError(() => of<State>({ status: 'error' })),
          startWith<State>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as State },
  );

  protected readonly rows = computed<Row[]>(() => {
    const state = this.state();
    if (state.status !== 'ready') return [];
    const culture = this.lang.current() ?? undefined;
    const dayFormat = new Intl.DateTimeFormat(culture, { day: 'numeric' });
    const monthFormat = new Intl.DateTimeFormat(culture, { month: 'short' });
    const whenFormat = new Intl.DateTimeFormat(culture, { dateStyle: 'full', timeStyle: 'short' });

    const eventsPage = this.site.pathOfType(EVENTS_LIST_TYPE);
    const automaticPage = (slug: string) =>
      eventsPage ? `${eventsPage.replace(/\/$/, '')}/${encodeURIComponent(slug)}` : null;

    return state.events.map((event) => {
      const start = event.dateFrom ? new Date(event.dateFrom) : null;
      return {
        ...event,
        pagePath: this.site.pathOfProperty('pretixEvent', event.slug) ?? automaticPage(event.slug),
        day: start ? dayFormat.format(start) : '',
        month: start ? monthFormat.format(start) : '',
        when: start ? whenFormat.format(start) : '',
      };
    });
  });
}

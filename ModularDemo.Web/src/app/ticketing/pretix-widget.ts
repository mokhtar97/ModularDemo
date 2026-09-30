import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, filter, map, of } from 'rxjs';
import { LanguageService } from '../site/language.service';
import { PretixWidgetLoader } from './pretix-widget-loader';
import { PretixService } from './pretix.service';

/** Display mode: the full shop inline, or a button that opens it in an overlay. */
export type PretixWidgetMode = 'widget' | 'button';

/**
 * pretix ticket shop for one event, as the embedded widget or as a button.
 *
 *   <app-pretix-widget [event]="'summer-2026'" />
 *   <app-pretix-widget organizer="myorg" event="summer-2026" mode="button" label="Buy tickets" />
 *
 * The pretix URL and default organizer come from GET /api/pretix/settings (appsettings "Pretix").
 * Assets load on first use only (PretixWidgetLoader). pretix replaces the custom element with its
 * own markup, so the element lives in a wrapper that is re-created whenever the event or mode
 * changes, and widgets are (re)built after rendering and after every router navigation.
 */
@Component({
  selector: 'app-pretix-widget',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (eventUrl(); as url) {
      @for (key of [renderKey()]; track key) {
        <div class="pretix-host">
          @if (mode() === 'button') {
            <pretix-button [attr.event]="url">{{
              label() || lang.t('Tickets.Buy', 'Buy tickets')
            }}</pretix-button>
          } @else {
            <pretix-widget [attr.event]="url"></pretix-widget>
          }
        </div>
      }
      @if (failed()) {
        <p class="fallback">
          <a [href]="url" target="_blank" rel="noopener">{{
            lang.t('Tickets.OpenShop', 'Open the ticket shop')
          }}</a>
        </p>
      }
    } @else if (settingsFailed()) {
      <p class="fallback">
        {{ lang.t('Tickets.Unavailable', 'The ticket shop is not available right now.') }}
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .pretix-host {
      min-height: 3rem;
    }
    .fallback {
      margin: 0.5rem 0 0;
    }
    .fallback a {
      font-weight: 600;
    }
  `,
})
export class PretixWidget {
  private readonly loader = inject(PretixWidgetLoader);
  private readonly injector = inject(Injector);
  protected readonly lang = inject(LanguageService);

  /** pretix organizer slug; empty = the site default (Pretix:Organizer). */
  readonly organizer = input<string | null | undefined>();
  /** pretix event slug, e.g. "summer-2026". */
  readonly event = input.required<string>();
  /** "widget" (default) renders <pretix-widget>, "button" renders <pretix-button>. */
  readonly mode = input<PretixWidgetMode>('widget');
  /** Button text in "button" mode (default: dictionary item Tickets.Buy). */
  readonly label = input<string>();

  private readonly settings = toSignal(
    inject(PretixService)
      .settings()
      .pipe(catchError(() => of(null))),
    { initialValue: undefined },
  );

  protected readonly settingsFailed = computed(() => this.settings() === null);
  protected readonly failed = signal(false);

  private readonly organizerSlug = computed(
    () => this.organizer()?.trim() || this.settings()?.organizer || null,
  );

  /** e.g. "http://localhost:8345/myorg/summer-2026/" — what pretix expects in event="". */
  protected readonly eventUrl = computed(() => {
    const settings = this.settings();
    const organizer = this.organizerSlug();
    const event = this.event()?.trim();
    if (!settings || !organizer || !event) return null;
    return `${settings.baseUrl}${encodeURIComponent(organizer)}/${encodeURIComponent(event)}/`;
  });

  /** Changes whenever the rendered element must be replaced. */
  protected readonly renderKey = computed(() => `${this.mode()}|${this.eventUrl()}`);

  constructor() {
    // After the element is in the DOM: load the assets (once) and build the widget.
    afterRenderEffect(() => {
      this.renderKey(); // re-run when the event or mode changes
      const settings = this.settings();
      const url = this.eventUrl();
      if (!settings || !url) return;

      const version = settings.widgetVersion;
      this.loader.loadStyles(`${url}widget/${version}.css`);
      const language = (this.lang.current() ?? 'en').split('-')[0].toLowerCase();
      const scripts = [...new Set([language, 'en'])].map(
        (lang) => `${settings.baseUrl}widget/${version}.${lang}.js`,
      );

      this.failed.set(false);
      this.loader
        .loadScript(scripts)
        .then(() => this.loader.build())
        .catch(() => this.failed.set(true));
    });

    // SPA navigation: pretix only scans the DOM when asked, so rebuild after each route change.
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        map(() => null),
        takeUntilDestroyed(),
      )
      .subscribe(() =>
        afterNextRender(() => void this.loader.build(), { injector: this.injector }),
      );
  }
}

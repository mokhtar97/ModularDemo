import { Component, computed, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { KeyValuePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { PropertyValue } from '../content/property-value';
import { hasValue, keepOrder } from '../content/content.utils';
import { pageTitle, SiteService } from './site.service';
import { LanguageService } from './language.service';
import { ContentLink, ContentNode } from '../content/content.models';
import { SitePageData } from './site.models';
import { PretixWidget } from '../ticketing/pretix-widget';
import { EVENTS_LIST_TYPE, UpcomingEvents } from '../ticketing/upcoming-events';
import { PretixEventPage } from '../ticketing/pretix-event-page';
import { PretixProducts } from '../ticketing/pretix-products';
import { TicketShopProperties } from '../ticketing/pretix.models';

/** Rendered as the page heading (<h1>) at its position; everything else via PropertyValue. */
const TITLE_PROPERTY = 'pageTitle';

/** pretix settings on event pages: used for the ticket shop, never shown as content. */
const TICKET_PROPERTIES = new Set(['pretixOrganizer', 'pretixEvent', 'showTicketShop']);

/**
 * Catch-all page: resolves the current URL against the site tree loaded by SiteService.
 * The router reuses this instance across navigations, so everything derives from the URL signal.
 */
@Component({
  selector: 'app-site-page',
  imports: [
    RouterLink,
    KeyValuePipe,
    PropertyValue,
    PretixWidget,
    UpcomingEvents,
    PretixEventPage,
    PretixProducts,
  ],
  template: `
    @if (site.loading() || (!site.root() && !site.error())) {
      <p class="status" role="status">{{ lang.t('Site.Loading', 'Loading…') }}</p>
    } @else if (site.error(); as error) {
      <section class="status" role="alert">
        <h1>{{ lang.t('Site.LoadError', "Couldn't load the site") }}</h1>
        <p>{{ error }}</p>
        <button type="button" (click)="site.load()">
          {{ lang.t('Site.TryAgain', 'Try again') }}
        </button>
      </section>
    } @else if (page(); as page) {
      <!-- Properties render in the order the API returns them (the document type's order). -->
      <article class="page">
        @if (!hasTitleProperty()) {
          <h1 class="page-title">{{ title() }}</h1>
        }
        @for (prop of page.node.properties | keyvalue: keepOrder; track prop.key) {
          @if (prop.key === titleProperty) {
            <h1 class="page-title">{{ title() }}</h1>
          } @else if (isShown(prop.key, prop.value)) {
            <app-property-value [value]="prop.value" />
          }
        }

        @if (ticketShop(); as shop) {
          <section class="tickets" aria-labelledby="tickets-title">
            <h2 id="tickets-title">{{ lang.t('Tickets.Products', 'Ticket types') }}</h2>
            <app-pretix-products [event]="shop.event" />
            <h2>{{ lang.t('Tickets.Title', 'Tickets') }}</h2>
            <app-pretix-widget [organizer]="shop.organizer" [event]="shop.event" />
          </section>
        }

        @if (isEventsList()) {
          <app-upcoming-events />
        } @else if (children().length) {
          <ul class="cards">
            @for (child of children(); track child.node.key) {
              <li class="card">
                <a [routerLink]="'/' + child.path">
                  @if (cardImage(child.node); as img) {
                    <img [src]="img.url" [alt]="img.name" loading="lazy" />
                  }
                  <div class="card-body">
                    <h2>{{ cardTitle(child.node) }}</h2>
                    @if (cardPrice(child.node); as price) {
                      <p class="price">{{ price }}</p>
                    }
                    @if (cardText(child.node); as text) {
                      <p class="card-text">{{ text }}</p>
                    }
                  </div>
                </a>
              </li>
            }
          </ul>
        }
      </article>
    } @else if (pretixEvent(); as ev) {
      <!-- "<events page>/<slug>" without an Umbraco item: a page built from pretix. -->
      <app-pretix-event-page [slug]="ev.slug" [backPath]="ev.backPath" />
    } @else {
      <section class="status">
        <h1>{{ lang.t('Site.NotFound', 'Page not found') }}</h1>
        <p>
          {{ lang.t('Site.NotFoundText', "There's no page at") }}
          <code dir="ltr">{{ path() }}</code>
        </p>
        <a routerLink="/">{{ lang.t('Site.BackHome', 'Back to the home page') }}</a>
      </section>
    }
  `,
  styles: `
    .page {
      display: grid;
      gap: 1.5rem;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      line-height: 1.25;
      color: var(--heading);
    }
    .tickets {
      display: grid;
      gap: 0.75rem;
    }
    .tickets h2 {
      margin: 0.5rem 0 0;
      font-size: 1.4rem;
      color: var(--heading);
    }
    .page-title {
      padding-bottom: 0.6rem;
      border-bottom: 3px solid var(--accent);
      justify-self: start;
    }
    .status {
      padding: 2rem 0;
    }
    .cards {
      list-style: none;
      padding: 0;
      margin: 2rem 0 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1rem;
    }
    .card a {
      display: flex;
      flex-direction: column;
      height: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      color: inherit;
      text-decoration: none;
      transition:
        box-shadow 0.15s,
        transform 0.15s;
    }
    .card a:hover {
      box-shadow: 0 6px 18px rgb(0 0 0 / 0.12);
      transform: translateY(-2px);
    }
    .card img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: var(--accent-soft);
    }
    .card-body {
      padding: 0.9rem 1rem 1.1rem;
    }
    .card h2 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--heading);
      text-transform: capitalize;
    }
    .price {
      margin: 0.35rem 0 0;
      font-weight: 600;
      color: var(--accent);
    }
    .card-text {
      margin: 0.35rem 0 0;
      color: var(--muted);
    }
    button {
      font: inherit;
      padding: 0.5rem 1.1rem;
      border: 0;
      border-radius: 999px;
      background: var(--brand);
      color: var(--on-brand);
      cursor: pointer;
    }
    button:hover {
      background: var(--brand-strong);
    }
  `,
})
export class SitePage {
  private readonly router = inject(Router);
  protected readonly site = inject(SiteService);
  protected readonly lang = inject(LanguageService);

  protected readonly keepOrder = keepOrder;

  /** Current router URL, e.g. "/about-zoo". */
  protected readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly page = computed(() =>
    this.site.root() ? this.site.findByPath(this.path()) : null,
  );

  protected readonly title = computed(() => {
    const page = this.page();
    return page ? pageTitle(page.node) : '';
  });

  /** Child pages (e.g. the products under /product), shown as cards below the body. */
  protected readonly children = computed<SitePageData[]>(() => {
    const page = this.page();
    // The home page's children are already in the top navigation.
    return page && page.path !== '' ? this.site.childrenOf(page.node) : [];
  });

  protected readonly titleProperty = TITLE_PROPERTY;

  /** pretix shop for this page, when "showTicketShop" is on and "pretixEvent" is set. */
  protected readonly ticketShop = computed<TicketShopProperties | null>(() => {
    const props = this.page()?.node.properties;
    const event = props?.['pretixEvent'];
    if (props?.['showTicketShop'] !== true || typeof event !== 'string' || !event.trim())
      return null;
    const organizer = props['pretixOrganizer'];
    return {
      event: event.trim(),
      organizer: typeof organizer === 'string' ? organizer.trim() || null : null,
    };
  });

  /**
   * For a URL with no Umbraco page whose parent is the events list ("/events/eelxc"):
   * the pretix event slug (last segment, case kept) and the list's path.
   */
  protected readonly pretixEvent = computed<{ slug: string; backPath: string } | null>(() => {
    if (!this.site.root() || this.page()) return null;
    const segments = this.path().split(/[?#]/)[0].split('/').filter(Boolean);
    if (segments.length < 2) return null;
    let slug: string;
    try {
      slug = decodeURIComponent(segments[segments.length - 1]);
    } catch {
      return null;
    }
    const parent = this.site.findByPath('/' + segments.slice(0, -1).join('/'));
    if (
      parent?.node.contentType !== EVENTS_LIST_TYPE ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(slug)
    )
      return null;
    return { slug, backPath: '/' + parent.path };
  });

  protected readonly isEventsList = computed(
    () => this.page()?.node.contentType === EVENTS_LIST_TYPE,
  );

  /** Whether the page has a pageTitle property (else the heading goes first, from the node name). */
  protected readonly hasTitleProperty = computed(
    () => !!this.page() && TITLE_PROPERTY in this.page()!.node.properties,
  );

  constructor() {
    const documentTitle = inject(Title);
    this.site.load();

    effect(() => {
      const siteName = this.site.siteName();
      const page = this.page();
      if (!siteName) return;

      if (page)
        documentTitle.setTitle(page.path === '' ? siteName : `${this.title()} | ${siteName}`);
      else if (!this.site.loading() && !this.pretixEvent())
        documentTitle.setTitle(`${this.lang.t('Site.NotFound', 'Page not found')} | ${siteName}`);
    });
  }

  protected cardTitle(node: ContentNode): string {
    const name = node.properties['productName'];
    return typeof name === 'string' && name.trim() ? name.trim() : pageTitle(node);
  }

  protected cardPrice(node: ContentNode): string | null {
    const price = node.properties['price'];
    return typeof price === 'number'
      ? price.toLocaleString(this.lang.current() ?? undefined)
      : null;
  }

  protected cardText(node: ContentNode): string | null {
    const text = node.properties['description'];
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  }

  /** First picked image on the node (single media picker or the first of a multiple one). */
  protected cardImage(node: ContentNode): ContentLink | null {
    for (const value of Object.values(node.properties)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (isImageRef(item)) return item;
      }
    }
    return null;
  }

  /** Every non-empty property is shown (text, images, video, pickers, blocks…) except pretix settings. */
  protected isShown(alias: string, value: unknown): boolean {
    if (TICKET_PROPERTIES.has(alias)) return false;
    return typeof value === 'string' ? value.trim() !== '' : hasValue(value);
  }
}

function isImageRef(x: unknown): x is ContentLink {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return r['contentType'] === 'Image' && typeof r['url'] === 'string' && !('properties' in r);
}

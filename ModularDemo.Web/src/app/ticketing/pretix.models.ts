/**
 * Shapes returned by the Ticketing module's pretix proxy (/api/pretix/...).
 * Mirrors ModularDemo.Modules.Ticketing/Features/PretixDtos.cs — keep them in sync.
 */

/** Public widget settings (GET /api/pretix/settings). No secrets. */
export interface PretixSettings {
  /** pretix root URL for browsers, with a trailing slash, e.g. "http://localhost:8345/". */
  baseUrl: string;
  /** Default organizer slug, used when a page doesn't set pretixOrganizer. */
  organizer: string | null;
  /** Widget asset version, e.g. "v1". */
  widgetVersion: string;
}

/** A pretix event, translatable fields already localized. Dates are ISO strings. */
export interface PretixEvent {
  slug: string;
  name: string;
  /** The shop is switched on in pretix (visitors can buy). */
  live: boolean;
  /** Orders are test orders. */
  testMode: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  dateAdmission: string | null;
  location: string | null;
  currency: string | null;
  hasSubevents: boolean;
  presaleStart: string | null;
  presaleEnd: string | null;
  /** The event's shop page in pretix. */
  shopUrl: string;
}

export interface PretixVariation {
  id: number;
  name: string;
  price: number | null;
}

/** A product (ticket type). */
export interface PretixItem {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  admission: boolean;
  variations: PretixVariation[];
}

/** Quota availability; `size`/`availableNumber` null = unlimited. */
export interface PretixQuota {
  id: number;
  name: string;
  size: number | null;
  available: boolean | null;
  availableNumber: number | null;
  itemIds: number[];
  variationIds: number[];
}

/** Ticket-shop settings on an Umbraco page (document type "event"). */
export interface TicketShopProperties {
  organizer: string | null;
  event: string;
}

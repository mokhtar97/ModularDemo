import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { PretixEvent, PretixItem, PretixQuota, PretixSettings } from './pretix.models';

const base = '/api/pretix';
const withCulture = (url: string, culture?: string | null) =>
  culture ? `${url}?culture=${encodeURIComponent(culture)}` : url;

/** URL builders for the pretix proxy endpoints (proxied to the .NET host in dev). */
export const pretixApi = {
  settings: () => `${base}/settings`,
  events: (culture?: string | null) => withCulture(`${base}/events`, culture),
  event: (slug: string, culture?: string | null) =>
    withCulture(`${base}/events/${encodeURIComponent(slug)}`, culture),
  items: (slug: string, culture?: string | null) =>
    withCulture(`${base}/events/${encodeURIComponent(slug)}/items`, culture),
  quotas: (slug: string) => `${base}/events/${encodeURIComponent(slug)}/quotas`,
};

/** How long items/quotas responses are shared between components (e.g. event page + product list). */
const SHARE_MS = 60_000;

/**
 * Talks to the Umbraco-side pretix proxy — never to pretix directly, so the API token
 * stays on the server. Errors: 404 not found, 502 pretix down, 503 not configured, 504 timeout.
 */
@Injectable({ providedIn: 'root' })
export class PretixService {
  private readonly http = inject(HttpClient);
  private readonly shared = new Map<string, { until: number; data: Observable<unknown> }>();

  /** Fetched once per app load and shared; retried on the next call after an error. */
  private readonly settings$ = this.http
    .get<PretixSettings>(pretixApi.settings())
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** Public widget settings (pretix URL, default organizer, widget version). */
  settings(): Observable<PretixSettings> {
    return this.settings$;
  }

  /** Future, live events of the configured organizer, soonest first. */
  events(culture?: string | null): Observable<PretixEvent[]> {
    return this.http.get<PretixEvent[]>(pretixApi.events(culture));
  }

  event(slug: string, culture?: string | null): Observable<PretixEvent> {
    return this.http.get<PretixEvent>(pretixApi.event(slug, culture));
  }

  /** Products and prices of an event. */
  items(slug: string, culture?: string | null): Observable<PretixItem[]> {
    return this.share(pretixApi.items(slug, culture));
  }

  /** Availability per quota. */
  quotas(slug: string): Observable<PretixQuota[]> {
    return this.share(pretixApi.quotas(slug));
  }

  /**
   * One request per URL for SHARE_MS: components asking for the same data at the same time
   * (the event page and its product list) reuse it. Failed requests are not kept.
   */
  private share<T>(url: string): Observable<T> {
    const hit = this.shared.get(url);
    if (hit && hit.until > Date.now()) return hit.data as Observable<T>;
    const data = this.http
      .get<T>(url)
      .pipe(
        tap({ error: () => this.shared.delete(url) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.shared.set(url, { until: Date.now() + SHARE_MS, data });
    return data;
  }
}

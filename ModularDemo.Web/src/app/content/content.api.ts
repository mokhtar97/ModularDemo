import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContentNode, Language, SearchResult } from './content.models';

/**
 * URL builders for the Content module endpoints (proxied to the .NET host in dev).
 * Use these with httpResource(); `depth` = levels of children to include (0–5, 0 = none).
 * `culture` (e.g. "ar") picks the language; omit it for Umbraco's default language.
 */
const base = '/api/content';

const query = (depth: number, culture?: string | null) =>
  `depth=${depth}` + (culture ? `&culture=${encodeURIComponent(culture)}` : '');

export const contentApi = {
  byUrl: (url: string, depth = 0, culture?: string | null) =>
    `${base}/by-url?url=${encodeURIComponent(url)}&${query(depth, culture)}`,
  byId: (id: number, depth = 0, culture?: string | null) =>
    `${base}/nodes/${id}?${query(depth, culture)}`,
  byKey: (key: string, depth = 0, culture?: string | null) =>
    `${base}/nodes/${encodeURIComponent(key)}?${query(depth, culture)}`,
  byType: (contentTypeAlias: string, depth = 0, culture?: string | null) =>
    `${base}/by-type/${encodeURIComponent(contentTypeAlias)}?${query(depth, culture)}`,
  languages: () => `${base}/languages`,
  dictionary: (culture?: string | null) =>
    `${base}/dictionary` + (culture ? `?culture=${encodeURIComponent(culture)}` : ''),
  /** Full-text search; `root` limits results to one site subtree (a node key). */
  search: (q: string, culture?: string | null, root?: string, take = 8) =>
    `/api/search?q=${encodeURIComponent(q)}&take=${take}` +
    (culture ? `&culture=${encodeURIComponent(culture)}` : '') +
    (root ? `&root=${encodeURIComponent(root)}` : ''),
};

/**
 * Observable wrapper around the same endpoints, for imperative use (event handlers, guards, resolvers).
 * `byUrl`/`byId`/`byKey` error with HTTP 404 when nothing is published there.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);

  byUrl(url: string, depth = 0, culture?: string | null): Observable<ContentNode> {
    return this.http.get<ContentNode>(contentApi.byUrl(url, depth, culture));
  }

  byId(id: number, depth = 0, culture?: string | null): Observable<ContentNode> {
    return this.http.get<ContentNode>(contentApi.byId(id, depth, culture));
  }

  byKey(key: string, depth = 0, culture?: string | null): Observable<ContentNode> {
    return this.http.get<ContentNode>(contentApi.byKey(key, depth, culture));
  }

  byType(contentTypeAlias: string, depth = 0, culture?: string | null): Observable<ContentNode[]> {
    return this.http.get<ContentNode[]>(contentApi.byType(contentTypeAlias, depth, culture));
  }

  languages(): Observable<Language[]> {
    return this.http.get<Language[]>(contentApi.languages());
  }

  search(q: string, culture?: string | null, root?: string, take = 8): Observable<SearchResult[]> {
    return this.http.get<SearchResult[]>(contentApi.search(q, culture, root, take));
  }

  /** Dictionary items (Umbraco Translation section) as `{ key: text }`. */
  dictionary(culture?: string | null): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(contentApi.dictionary(culture));
  }
}

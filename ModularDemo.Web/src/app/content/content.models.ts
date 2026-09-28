/**
 * Shapes returned by the monolith's Content module (/api/content/...).
 * Mirrors ModularDemo.Modules.Content/Features/ContentNodeDto.cs — keep them in sync.
 */
export interface ContentNode {
  id: number;
  key: string;
  name: string;
  contentType: string;
  url: string;
  level: number;
  sortOrder: number;
  createDate: string;
  updateDate: string;
  properties: Record<string, PropertyValueData>;
  /** null when the request's depth didn't reach this level. */
  children: ContentNode[] | null;
}

/** A picked content or media item (a reference, not the full node). */
export interface ContentLink {
  id: number;
  key: string;
  name: string;
  contentType: string;
  url: string;
}

/** A link from a multi URL picker. `type` is Umbraco's LinkType: "Content" | "Media" | "External". */
export interface Link {
  name: string | null;
  url: string | null;
  target: string | null;
  type: string;
}

/** A block (or any other element): content type, key and its own converted properties. */
export interface Element {
  contentType: string;
  key: string;
  properties: Record<string, PropertyValueData>;
}

export interface BlockListItem {
  content: Element;
  settings: Element | null;
}

export interface BlockGridItem {
  content: Element;
  settings: Element | null;
  rowSpan: number;
  columnSpan: number;
  areas: BlockGridArea[];
}

export interface BlockGridArea {
  alias: string;
  rowSpan: number;
  columnSpan: number;
  items: BlockGridItem[];
}

/**
 * A converted property value. Rich text arrives as an HTML string; anything the backend
 * doesn't map explicitly (image cropper, colour picker, ...) arrives as raw JSON.
 */
export type PropertyValueData =
  | string
  | number
  | boolean
  | null
  | ContentLink
  | Link
  | Element
  | PropertyValueData[]
  | { [key: string]: unknown };

/** A language from Umbraco's Settings → Languages (GET /api/content/languages). */
export interface Language {
  /** Culture code, e.g. "en-US" or "ar". Pass it as `culture` to the content endpoints. */
  isoCode: string;
  /** Umbraco's display name, e.g. "English (United States)". */
  name: string;
  isDefault: boolean;
  fallbackIsoCode: string | null;
}

/** One hit from GET /api/search (mirrors SearchResultDto). */
export interface SearchResult {
  key: string;
  name: string;
  /** Umbraco URL; the frontend maps `key` to its own route instead. */
  url: string;
  contentType: string;
  excerpt: string | null;
}

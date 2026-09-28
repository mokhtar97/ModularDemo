import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ContentService } from '../content/content.api';
import { ContentNode } from '../content/content.models';
import { NavItem, SitePageData } from './site.models';
import { SITE_ROOT_KEY, SITE_TREE_DEPTH } from './site.config';
import { LanguageService } from './language.service';

/**
 * Loads the site tree (root by key + descendants) in the current language and resolves
 * Angular paths to nodes. Call load() at startup, after an error to retry, and after
 * switching language (it reloads only when the culture changed).
 */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly content = inject(ContentService);
  private readonly language = inject(LanguageService);
  private request?: Subscription;

  private readonly state = signal<{
    root: ContentNode | null;
    error: string | null;
    loading: boolean;
    /** Culture of the tree in `root` (or being loaded). */
    culture: string | null;
  }>({
    root: null,
    error: null,
    loading: false,
    culture: null,
  });

  readonly root = computed(() => this.state().root);
  readonly error = computed(() => this.state().error);
  readonly loading = computed(() => this.state().loading);

  readonly siteName = computed(() => {
    const root = this.root();
    return root ? pageTitle(root) : '';
  });

  /** Every node in the tree keyed by its normalized path ("" = root). */
  private readonly pages = computed(() => indexTree(this.root()));

  readonly nav = computed<NavItem[]>(() => {
    const root = this.root();
    if (!root) return [];

    const byKey = new Map([...this.pages().values()].map((p) => [p.node.key, p.path]));
    const children = [...(root.children ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

    return [
      { label: this.language.t('Nav.Home', 'Home'), path: '/' },
      ...children.map((child) => ({ label: child.name, path: '/' + (byKey.get(child.key) ?? '') })),
    ];
  });

  load(): void {
    const culture = this.language.current();
    const { root, loading, culture: loaded } = this.state();
    if ((root || loading) && this.language.same(loaded, culture)) return;

    // Keep the previous language's tree (and nav) on screen until the new one arrives.
    this.request?.unsubscribe();
    this.state.update((s) => ({ ...s, error: null, loading: true, culture }));
    this.request = this.content.byKey(SITE_ROOT_KEY, SITE_TREE_DEPTH, culture).subscribe({
      next: (node) => this.state.set({ root: node, error: null, loading: false, culture }),
      error: (err: unknown) =>
        this.state.set({ root: null, error: describeError(err), loading: false, culture }),
    });
  }

  /** Router path ("/about-zoo") of the node with this key in the loaded tree, or null. */
  pathOfKey(key: string): string | null {
    for (const page of this.pages().values()) if (page.node.key === key) return '/' + page.path;
    return null;
  }

  /** Child pages of a node, in Umbraco sort order, each with its Angular path. */
  childrenOf(node: ContentNode): SitePageData[] {
    const byKey = new Map([...this.pages().values()].map((p) => [p.node.key, p]));
    return [...(node.children ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((child) => byKey.get(child.key))
      .filter((p): p is SitePageData => !!p);
  }

  /** Resolves a router URL ("/About-Zoo/?x=1#top") to its page, or null when nothing matches. */
  findByPath(url: string): SitePageData | null {
    return this.pages().get(normalizePath(url)) ?? null;
  }
}

/** Page title property, falling back to the node name. */
export function pageTitle(node: ContentNode): string {
  const title = node.properties['pageTitle'];
  return typeof title === 'string' && title.trim() ? title.trim() : node.name;
}

/** "/About-Zoo/?x=1#top" -> "about-zoo"; "/" -> "". */
export function normalizePath(url: string): string {
  let path = url.split(/[?#]/)[0];
  try {
    path = decodeURI(path);
  } catch {
    // keep the raw path if it isn't valid percent-encoding
  }
  return path.replace(/^\/+|\/+$/g, '').toLowerCase();
}

export function indexTree(root: ContentNode | null): Map<string, SitePageData> {
  const pages = new Map<string, SitePageData>();
  if (!root) return pages;

  const rootPath = normalizePath(urlPath(root.url) ?? '');

  const visit = (node: ContentNode, parentPath: string | null) => {
    const path = parentPath === null ? '' : relativePath(node, parentPath, rootPath);
    if (!pages.has(path)) pages.set(path, { node, path }); // first one wins on collisions
    for (const child of node.children ?? []) visit(child, path);
  };

  visit(root, null);
  return pages;
}

function relativePath(node: ContentNode, parentPath: string, rootPath: string): string {
  const url = urlPath(node.url);
  if (url === null) return [parentPath, slugify(node.name)].filter(Boolean).join('/');

  const path = normalizePath(url);
  // Children of the root usually live under its URL ("/home-page-zoo/about-zoo/"), but with
  // Umbraco's HideTopLevelNodeFromPath the top-level segment is dropped ("/about-zoo/"), so only
  // strip the root prefix when it's actually there.
  if (rootPath && path.startsWith(rootPath + '/')) return path.slice(rootPath.length + 1);
  return path;
}

/** Path part of a node URL; null when Umbraco has no URL for it ("#" or empty). */
function urlPath(url: string | null | undefined): string | null {
  if (!url || url === '#') return null;
  if (/^https?:\/\//i.test(url)) return new URL(url).pathname;
  return url;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function describeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 404)
      return `The site's home page (key ${SITE_ROOT_KEY}) wasn't found. It isn't published in Umbraco, or SITE_ROOT_KEY is wrong.`;
    // 0 = browser couldn't connect; 502–504 = the dev proxy couldn't reach the .NET host.
    if (err.status === 0 || (err.status >= 502 && err.status <= 504))
      return "Couldn't reach the Umbraco site. Make sure it's running on https://localhost:44366.";
    return `Umbraco returned an error (${err.status} ${err.statusText}).`;
  }
  return 'Something went wrong while loading the site.';
}

import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ContentService } from '../content/content.api';
import { SearchResult } from '../content/content.models';
import { LanguageService } from './language.service';
import { SiteService } from './site.service';
import { SITE_ROOT_KEY } from './site.config';

/** Minimum characters before searching (the API ignores shorter words too). */
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;
const TAKE = 8;

interface Hit extends SearchResult {
  /** Angular route for the result, from the loaded site tree. */
  path: string;
}

/**
 * Navbar search. The header only holds a compact button (so it never grows or wraps);
 * clicking it — or pressing Ctrl/⌘+K or "/" — opens a search panel over the page.
 * Queries /api/search as you type (debounced, current language, this site only).
 * Keyboard: ↑/↓ move, Enter opens, Esc closes.
 */
@Component({
  selector: 'app-site-search',
  host: { '(document:keydown)': 'onDocumentKeydown($event)' },
  template: `
    <button
      #trigger
      type="button"
      class="trigger"
      aria-haspopup="dialog"
      [attr.aria-expanded]="expanded()"
      [attr.aria-label]="lang.t('Search.Label', 'Search the site')"
      (click)="openPanel()"
    >
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span class="trigger-text">{{ lang.t('Search.Placeholder', 'Search…') }}</span>
      <kbd class="shortcut" aria-hidden="true">{{ shortcut }}</kbd>
    </button>

    @if (expanded()) {
      <div class="backdrop" (click)="close()"></div>
      <div
        class="panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="lang.t('Search.Label', 'Search the site')"
      >
        <div class="field">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #input
            type="search"
            role="combobox"
            autocomplete="off"
            enterkeyhint="search"
            aria-autocomplete="list"
            aria-controls="site-search-results"
            [attr.aria-expanded]="hasQuery()"
            [attr.aria-activedescendant]="active() >= 0 ? 'site-search-result-' + active() : null"
            [attr.aria-label]="lang.t('Search.Label', 'Search the site')"
            [placeholder]="lang.t('Search.Placeholder', 'Search…')"
            [value]="query()"
            (input)="onInput($any($event.target).value)"
            (keydown)="onKeydown($event)"
          />
          <button type="button" class="close" (click)="close()">
            <span class="visually-hidden">{{ lang.t('Search.Close', 'Close') }}</span>
            <kbd aria-hidden="true">Esc</kbd>
          </button>
        </div>

        @if (hasQuery()) {
          <ul id="site-search-results" class="results" role="listbox">
            @for (hit of hits(); track hit.key; let i = $index) {
              <li
                role="option"
                [id]="'site-search-result-' + i"
                [class.active]="i === active()"
                [attr.aria-selected]="i === active()"
                (mouseenter)="active.set(i)"
                (mousedown)="$event.preventDefault()"
                (click)="go(hit)"
              >
                <span class="name">{{ hit.name }}</span>
                @if (hit.excerpt) {
                  <span class="excerpt">{{ hit.excerpt }}</span>
                }
                <span class="path" dir="ltr">{{ hit.path }}</span>
              </li>
            } @empty {
              <li class="note" role="presentation">
                {{
                  searching()
                    ? lang.t('Search.Searching', 'Searching…')
                    : lang.t('Search.NoResults', 'No results')
                }}
              </li>
            }
          </ul>
        } @else {
          <p class="note">{{ lang.t('Search.Hint', 'Type at least 2 letters to search') }}</p>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .icon {
      width: 1.05rem;
      height: 1.05rem;
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
    }

    /* ---- compact trigger in the header: fixed size, never grows ---- */
    .trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 2.25rem;
      padding: 0;
      padding-inline: 0.8rem 0.55rem;
      font: inherit;
      font-size: 0.9rem;
      color: var(--on-brand);
      background: rgb(255 255 255 / 0.12);
      border: 1px solid rgb(255 255 255 / 0.3);
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
    }
    .trigger:hover {
      background: rgb(255 255 255 / 0.2);
    }
    .trigger:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .trigger-text {
      opacity: 0.85;
      min-width: 4.5rem;
      text-align: start;
    }
    .shortcut {
      font:
        600 0.7rem/1 system-ui,
        sans-serif;
      padding: 0.25rem 0.4rem;
      border-radius: 6px;
      background: rgb(255 255 255 / 0.15);
      border: 1px solid rgb(255 255 255 / 0.25);
    }

    /* ---- search panel over the page ---- */
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgb(10 20 12 / 0.45);
      backdrop-filter: blur(2px);
      animation: fade 0.12s ease-out;
    }
    .panel {
      position: fixed;
      z-index: 41;
      top: 5.5rem;
      inset-inline: 0;
      margin-inline: auto;
      width: min(40rem, calc(100% - 2rem));
      max-height: calc(100vh - 7.5rem);
      display: flex;
      flex-direction: column;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: 0 24px 60px rgb(0 0 0 / 0.28);
      overflow: hidden;
      animation: drop 0.14s ease-out;
    }
    .field {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border);
      color: var(--muted);
    }
    .field .icon {
      width: 1.25rem;
      height: 1.25rem;
    }
    input {
      flex: 1;
      min-width: 0;
      font: inherit;
      font-size: 1.1rem;
      color: var(--text);
      background: transparent;
      border: 0;
      outline: none;
    }
    input::-webkit-search-cancel-button {
      display: none;
    }
    .close {
      border: 0;
      background: none;
      padding: 0;
      cursor: pointer;
      color: var(--muted);
    }
    .close kbd {
      font:
        600 0.72rem/1 system-ui,
        sans-serif;
      padding: 0.3rem 0.45rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg);
    }
    .results {
      list-style: none;
      margin: 0;
      padding: 0.4rem;
      overflow-y: auto;
    }
    li[role='option'] {
      display: grid;
      gap: 0.15rem;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      cursor: pointer;
    }
    li.active {
      background: var(--accent-soft);
    }
    .name {
      font-weight: 600;
      color: var(--heading);
      text-transform: capitalize;
    }
    .excerpt {
      font-size: 0.85rem;
      color: var(--text);
      opacity: 0.8;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .path {
      justify-self: start;
      font-size: 0.75rem;
      color: var(--muted);
    }
    .note {
      margin: 0;
      padding: 1rem 1.2rem;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
    }
    @keyframes drop {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
    }

    /* Narrow screens: icon-only trigger, panel near the top. */
    @media (max-width: 720px) {
      .trigger {
        width: 2.25rem;
        padding: 0;
        justify-content: center;
      }
      .trigger-text,
      .shortcut {
        display: none;
      }
      .panel {
        top: 0.75rem;
        max-height: calc(100vh - 1.5rem);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .backdrop,
      .panel {
        animation: none;
      }
    }
  `,
})
export class SiteSearch {
  private readonly router = inject(Router);
  private readonly content = inject(ContentService);
  private readonly site = inject(SiteService);
  private readonly injector = inject(Injector);
  protected readonly lang = inject(LanguageService);

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  protected readonly shortcut =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K';

  protected readonly expanded = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(-1);
  protected readonly searching = signal(false);

  protected readonly hasQuery = computed(() => this.query().trim().length >= MIN_LENGTH);

  /** Latest response, tagged with the query and culture it answers. */
  private readonly response = toSignal(
    combineLatest([toObservable(this.query), toObservable(this.lang.current)]).pipe(
      map(([q, culture]) => ({ q: q.trim(), culture })),
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged((a, b) => a.q === b.q && a.culture === b.culture),
      switchMap(({ q, culture }) =>
        q.length < MIN_LENGTH
          ? of({ q, items: [] as SearchResult[] })
          : this.content.search(q, culture, SITE_ROOT_KEY, TAKE).pipe(
              catchError(() => of([] as SearchResult[])),
              map((items) => ({ q, items })),
            ),
      ),
      tap(() => this.searching.set(false)),
    ),
    { initialValue: { q: '', items: [] as SearchResult[] } },
  );

  /** Hits that exist in the loaded site tree, with their Angular route. */
  protected readonly hits = computed<Hit[]>(() => {
    const { q, items } = this.response();
    if (q !== this.query().trim()) return []; // stale answer while typing
    return items.flatMap((item) => {
      const path = this.site.pathOfKey(item.key);
      return path ? [{ ...item, path }] : [];
    });
  });

  protected openPanel(): void {
    this.expanded.set(true);
    afterNextRender(() => this.input()?.nativeElement.focus(), { injector: this.injector });
  }

  protected close(restoreFocus = true): void {
    if (!this.expanded()) return;
    this.expanded.set(false);
    this.onInput('');
    if (restoreFocus) this.trigger().nativeElement.focus();
  }

  /** Ctrl/⌘+K anywhere, or "/" when not typing in a field, opens the panel. */
  protected onDocumentKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    if (
      (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) ||
      (event.key === '/' && !typing)
    ) {
      event.preventDefault();
      if (this.expanded()) this.input()?.nativeElement.focus();
      else this.openPanel();
    } else if (event.key === 'Escape' && this.expanded()) {
      event.preventDefault();
      this.close();
    }
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(-1);
    this.searching.set(value.trim().length >= MIN_LENGTH);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.hits().length;
    switch (event.key) {
      case 'ArrowDown':
        if (!count) return;
        event.preventDefault();
        this.active.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        if (!count) return;
        event.preventDefault();
        this.active.update((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter': {
        const hit = this.hits()[Math.max(this.active(), 0)];
        if (hit) {
          event.preventDefault();
          this.go(hit);
        }
        break;
      }
    }
  }

  protected go(hit: Hit): void {
    this.router.navigateByUrl(hit.path);
    this.close(false);
  }
}

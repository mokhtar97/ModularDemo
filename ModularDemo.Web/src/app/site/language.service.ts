import { computed, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { ContentService } from '../content/content.api';
import { Language } from '../content/content.models';

const STORAGE_KEY = 'zoo.culture';

/** Languages written right-to-left (by primary subtag). */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'dv', 'ku', 'sd', 'ug', 'yi']);

/**
 * The site's languages (from Umbraco Settings → Languages), the visitor's current choice
 * (remembered in localStorage), and Umbraco dictionary items for fixed UI text.
 * Also keeps <html lang> and <html dir> in step, so Arabic switches the page to RTL.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly content = inject(ContentService);
  private readonly document = inject(DOCUMENT);

  readonly languages = signal<Language[]>([]);

  /** What the visitor picked; null = the site's default language. */
  private readonly selected = signal<string | null>(readStored());

  private readonly dictionary = signal<Record<string, string>>({});
  private languagesRequested = false;
  private dictionaryCulture: string | null | undefined;

  /**
   * Culture to request content in. Before the language list arrives this is the stored choice
   * (or null); afterwards it is always a real ISO code, falling back to the default language.
   */
  readonly current = computed<string | null>(() => {
    const selected = this.selected();
    const languages = this.languages();
    if (!languages.length) return selected;
    return (
      languages.find((l) => sameCulture(l.isoCode, selected))?.isoCode ??
      languages.find((l) => l.isDefault)?.isoCode ??
      languages[0].isoCode
    );
  });

  readonly dir = computed<'rtl' | 'ltr'>(() => (isRtl(this.current()) ? 'rtl' : 'ltr'));

  constructor() {
    effect(() => {
      const html = this.document.documentElement;
      const culture = this.current();
      if (culture) html.lang = culture;
      html.dir = this.dir();
    });
  }

  /** Loads the language list and the dictionary for the current culture (once). */
  load(): void {
    if (!this.languagesRequested) {
      this.languagesRequested = true;
      this.content.languages().subscribe({
        next: (languages) => this.languages.set(languages),
        error: () => (this.languagesRequested = false), // switcher stays hidden; retry next load()
      });
    }
    this.loadDictionary();
  }

  /** Switches language. Callers reload content afterwards (SiteService.load()). */
  use(culture: string): void {
    this.selected.set(culture);
    try {
      localStorage.setItem(STORAGE_KEY, culture);
    } catch {
      // storage unavailable (private mode) - the choice just isn't remembered
    }
    this.loadDictionary();
  }

  /** Whether two cultures mean the same language; null stands for the default language. */
  same(a: string | null, b: string | null): boolean {
    const defaultCulture = this.languages().find((l) => l.isDefault)?.isoCode ?? null;
    const resolve = (c: string | null) => (c ?? defaultCulture)?.toLowerCase() ?? null;
    return resolve(a) === resolve(b);
  }

  /**
   * Fixed UI text from Umbraco's Translation section (dictionary item `key`),
   * or `fallback` when the item doesn't exist or has no text.
   */
  t(key: string, fallback: string): string {
    return this.dictionary()[key] ?? fallback;
  }

  /** Language name in its own language, e.g. "العربية", "English"; Umbraco's name as fallback. */
  label(language: Language): string {
    try {
      const own = new Intl.DisplayNames([language.isoCode], { type: 'language' }).of(language.isoCode);
      if (own) return own.charAt(0).toLocaleUpperCase(language.isoCode) + own.slice(1);
    } catch {
      // unknown code
    }
    return language.name;
  }

  private loadDictionary(): void {
    const culture = this.selected();
    if (this.dictionaryCulture === culture) return;
    this.dictionaryCulture = culture;
    this.content.dictionary(culture).subscribe({
      next: (items) => {
        if (this.dictionaryCulture === culture) this.dictionary.set(items);
      },
      error: () => {
        if (this.dictionaryCulture === culture) {
          this.dictionaryCulture = undefined;
          this.dictionary.set({}); // English fallbacks
        }
      },
    });
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function sameCulture(a: string, b: string | null): boolean {
  return !!b && a.toLowerCase() === b.toLowerCase();
}

export function isRtl(culture: string | null): boolean {
  return !!culture && RTL_LANGUAGES.has(culture.split('-')[0].toLowerCase());
}

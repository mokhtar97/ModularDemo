import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SiteService } from './site/site.service';
import { LanguageService } from './site/language.service';
import { SiteSearch } from './site/site-search';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SiteSearch],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly site = inject(SiteService);
  protected readonly lang = inject(LanguageService);

  /** Page to return to after a language switch (URLs can differ per language). */
  private readonly pendingKey = signal<string | null>(null);

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly headerInner = viewChild<ElementRef<HTMLElement>>('headerInner');

  /** True when brand + menu + tools don't fit on one line: the menu then gets its own row. */
  protected readonly stackedHeader = signal(false);

  constructor() {
    this.lang.load();
    this.site.load();

    // Re-measure the header when the window resizes or its content (menu, language) changes.
    afterNextRender(() => {
      const inner = this.headerInner()?.nativeElement;
      if (!inner || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measureHeader());
      observer.observe(inner);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    effect(() => {
      this.site.nav();
      this.lang.current();
      this.lang.languages();
      afterNextRender(() => this.measureHeader(), { injector: this.injector });
    });

    // Once the new language's tree has loaded, go to the same page in that language.
    effect(() => {
      const key = this.pendingKey();
      if (!key || this.site.loading() || !this.site.root()) return;
      this.pendingKey.set(null);
      const path = this.site.pathOfKey(key);
      if (path && path !== this.router.url.split(/[?#]/)[0]) this.router.navigateByUrl(path);
    });
  }

  /** Measures whether the header fits on one line (content changes with pages and language). */
  private measureHeader(): void {
    const inner = this.headerInner()?.nativeElement;
    const nav = inner?.querySelector('nav');
    if (!inner || !nav) return;
    const brand = inner.querySelector<HTMLElement>('.brand')?.offsetWidth ?? 0;
    const tools = inner.querySelector<HTMLElement>('.tools')?.offsetWidth ?? 0;
    const style = getComputedStyle(inner);
    const gap = parseFloat(style.columnGap) || 0;
    const available =
      inner.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // nav.scrollWidth is the menu's full content width, whether or not it is on its own row.
    this.stackedHeader.set(brand + nav.scrollWidth + tools + gap * 2 > available + 1);
  }

  protected changeLanguage(culture: string): void {
    if (this.lang.same(culture, this.lang.current())) return;
    this.pendingKey.set(this.site.findByPath(this.router.url)?.node.key ?? null);
    this.lang.use(culture);
    this.site.load();
  }
}

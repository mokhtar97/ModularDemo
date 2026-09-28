import { Component, effect, inject, signal } from '@angular/core';
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

  constructor() {
    this.lang.load();
    this.site.load();

    // Once the new language's tree has loaded, go to the same page in that language.
    effect(() => {
      const key = this.pendingKey();
      if (!key || this.site.loading() || !this.site.root()) return;
      this.pendingKey.set(null);
      const path = this.site.pathOfKey(key);
      if (path && path !== this.router.url.split(/[?#]/)[0]) this.router.navigateByUrl(path);
    });
  }

  protected changeLanguage(culture: string): void {
    if (this.lang.same(culture, this.lang.current())) return;
    this.pendingKey.set(this.site.findByPath(this.router.url)?.node.key ?? null);
    this.lang.use(culture);
    this.site.load();
  }
}

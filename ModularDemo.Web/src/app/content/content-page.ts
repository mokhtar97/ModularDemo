import { Component, computed, inject } from '@angular/core';
import { httpResource, HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { filter, map } from 'rxjs';
import { ContentNode } from './content.models';
import { contentApi } from './content.api';
import { PropertyValue } from './property-value';

/**
 * Catch-all page: whatever URL the browser is on, ask Umbraco (via the Content module)
 * for the node at that URL and render it.
 */
@Component({
  selector: 'app-content-page',
  imports: [RouterLink, DatePipe, KeyValuePipe, PropertyValue],
  template: `
    @if (page.isLoading()) {
      <p class="muted">Loading…</p>
    } @else if (notFound()) {
      <h1>Page not found</h1>
      <p class="muted">Nothing is published at <code>{{ path() }}</code> in Umbraco.</p>
      <a routerLink="/">Go home</a>
    } @else if (page.error()) {
      <h1>Couldn't load content</h1>
      <p class="muted">Is the .NET host running on https://localhost:44366?</p>
    } @else if (page.value(); as node) {
      <article>
        <header>
          <span class="badge">{{ node.contentType }}</span>
          <h1>{{ node.name }}</h1>
          <p class="muted">Updated {{ node.updateDate | date: 'medium' }}</p>
        </header>

        @for (prop of node.properties | keyvalue: keepOrder; track prop.key) {
          @if (hasValue(prop.value)) {
            <section class="prop">
              <h2>{{ label(prop.key) }}</h2>
              <app-property-value [value]="prop.value" />
            </section>
          }
        }

        @if (node.children.length) {
          <section>
            <h2>In this section</h2>
            <div class="cards">
              @for (child of node.children; track child.key) {
                <a class="card" [routerLink]="child.url">
                  <strong>{{ child.name }}</strong>
                  <span class="muted">{{ child.contentType }}</span>
                </a>
              }
            </div>
          </section>
        }
      </article>
    }
  `,
  styles: `
    header { margin-bottom: 1.5rem; }
    h1 { margin: .25rem 0; }
    h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 .5rem; }
    .prop { margin-bottom: 1.5rem; }
    .badge { font-size: .75rem; background: var(--accent-soft); color: var(--accent); padding: .15rem .5rem; border-radius: 999px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: .75rem; }
    .card { display: flex; flex-direction: column; gap: .25rem; padding: 1rem; border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit; }
    .card:hover { border-color: var(--accent); }
  `,
})
export class ContentPage {
  private readonly router = inject(Router);

  /** Current path without query string / fragment, e.g. "/about". */
  protected readonly path = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => stripQuery(e.urlAfterRedirects)),
    ),
    { initialValue: stripQuery(this.router.url) },
  );

  protected readonly page = httpResource<ContentNode>(() => contentApi.byUrl(this.path(), 1));

  protected readonly notFound = computed(() => {
    const err = this.page.error();
    return err instanceof HttpErrorResponse && err.status === 404;
  });

  protected keepOrder = () => 0;

  protected hasValue(v: unknown): boolean {
    return !(v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0));
  }

  /** "bodyText" -> "Body text" */
  protected label(alias: string): string {
    const words = alias.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}

function stripQuery(url: string): string {
  return url.split(/[?#]/)[0] || '/';
}

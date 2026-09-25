import { Component, computed, input } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

type Kind = 'empty' | 'text' | 'html' | 'images' | 'links' | 'list' | 'json';

interface MediaItem { url: string; name?: string }
interface LinkItem { title: string; path: string }

/** Renders one Umbraco property value (Delivery API format) in a sensible way. */
@Component({
  selector: 'app-property-value',
  imports: [JsonPipe, RouterLink],
  template: `
    @switch (kind()) {
      @case ('text') { <p>{{ value() }}</p> }
      @case ('html') { <div class="rte" [innerHTML]="html()"></div> }
      @case ('images') {
        <div class="images">
          @for (m of images(); track m.url) { <img [src]="m.url" [alt]="m.name ?? ''" loading="lazy" /> }
        </div>
      }
      @case ('links') {
        <ul>
          @for (l of links(); track l.path) { <li><a [routerLink]="l.path">{{ l.title }}</a></li> }
        </ul>
      }
      @case ('list') {
        <ul>@for (v of asArray(); track $index) { <li>{{ v }}</li> }</ul>
      }
      @case ('json') { <pre>{{ value() | json }}</pre> }
    }
  `,
  styles: `
    .images { display: flex; flex-wrap: wrap; gap: .75rem; }
    img { max-width: 100%; max-height: 320px; border-radius: 8px; }
    pre { background: var(--code-bg); padding: .75rem; border-radius: 6px; overflow: auto; font-size: .8rem; }
    p { margin: 0; white-space: pre-line; }
  `,
})
export class PropertyValue {
  readonly value = input<unknown>();

  protected readonly asArray = computed(() => (Array.isArray(this.value()) ? (this.value() as unknown[]) : []));

  protected readonly kind = computed<Kind>(() => {
    const v = this.value();
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return 'empty';
    if (typeof v === 'string') return v.trimStart().startsWith('<') ? 'html' : 'text';
    if (typeof v === 'number' || typeof v === 'boolean') return 'text';
    if (isObject(v) && typeof v['markup'] === 'string') return 'html';
    if (Array.isArray(v)) {
      if (v.every(x => isObject(x) && typeof x['url'] === 'string' && !isObject(x['route']))) return 'images';
      if (v.every(x => isObject(x) && isObject(x['route']))) return 'links';
      if (v.every(x => typeof x === 'string' || typeof x === 'number')) return 'list';
    }
    if (isObject(v) && isObject(v['route'])) return 'links';
    return 'json';
  });

  protected readonly html = computed(() => {
    const v = this.value();
    return typeof v === 'string' ? v : isObject(v) ? String(v['markup'] ?? '') : '';
  });

  protected readonly images = computed<MediaItem[]>(() => this.asArray() as MediaItem[]);

  protected readonly links = computed<LinkItem[]>(() => {
    const v = this.value();
    const items = Array.isArray(v) ? v : [v];
    return items.filter(isObject).map(x => ({
      title: String(x['name'] ?? x['title'] ?? 'Link'),
      path: String((x['route'] as Record<string, unknown>)['path'] ?? '/'),
    }));
  });
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

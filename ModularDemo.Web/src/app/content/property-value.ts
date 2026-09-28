import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { JsonPipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlockGridItem, BlockListItem, ContentLink, Element, Link } from './content.models';
import { hasValue, keepOrder, label } from './content.utils';

type Kind =
  'empty' | 'text' | 'html' | 'refs' | 'links' | 'blockList' | 'blockGrid' | 'list' | 'json';

/** Renders one converted Umbraco property value (see content.models.ts), recursing into blocks. */
@Component({
  selector: 'app-property-value',
  imports: [JsonPipe, KeyValuePipe, NgTemplateOutlet, RouterLink],
  template: `
    @switch (kind()) {
      @case ('text') {
        <div class="text">
          @for (block of paragraphs(); track $index) {
            @if (block.heading) {
              <h2 class="subheading">{{ block.text }}</h2>
            } @else {
              <p>{{ block.text }}</p>
            }
          }
        </div>
      }
      @case ('html') {
        <div class="rte" [innerHTML]="html()"></div>
      }
      @case ('refs') {
        <div class="refs">
          @for (ref of refs(); track ref.key) {
            @if (isImage(ref.url)) {
              <img [src]="ref.url" [alt]="ref.name" loading="lazy" />
            } @else if (isVideo(ref)) {
              <video [src]="ref.url" controls preload="metadata" [attr.aria-label]="ref.name"></video>
            } @else if (isMedia(ref.url)) {
              <a [href]="ref.url" target="_blank">{{ ref.name }}</a>
            } @else if (ref.url !== '#') {
              <a [routerLink]="ref.url">{{ ref.name }}</a>
            } @else {
              <span>{{ ref.name }}</span>
            }
          }
        </div>
      }
      @case ('links') {
        <ul>
          @for (l of links(); track $index) {
            <li>
              @if (l.type === 'Content' && l.url) {
                <a [routerLink]="l.url" [attr.target]="l.target">{{ l.name || l.url }}</a>
              } @else {
                <a [href]="l.url" [attr.target]="l.target">{{ l.name || l.url }}</a>
              }
            </li>
          }
        </ul>
      }
      @case ('blockList') {
        @for (block of blockList(); track block.content.key) {
          <ng-container *ngTemplateOutlet="element; context: { $implicit: block.content }" />
        }
      }
      @case ('blockGrid') {
        <ng-container *ngTemplateOutlet="grid; context: { $implicit: blockGrid() }" />
      }
      @case ('list') {
        <ul>
          @for (v of asArray(); track $index) {
            <li>{{ v }}</li>
          }
        </ul>
      }
      @case ('json') {
        <pre>{{ value() | json }}</pre>
      }
    }

    <ng-template #element let-el>
      <div class="block">
        <span class="badge">{{ el.contentType }}</span>
        @for (prop of el.properties | keyvalue: keepOrder; track prop.key) {
          @if (hasValue(prop.value)) {
            <div class="block-prop">
              <h3>{{ label(prop.key) }}</h3>
              <app-property-value [value]="prop.value" />
            </div>
          }
        }
      </div>
    </ng-template>

    <ng-template #grid let-items>
      <div class="grid">
        @for (item of items; track item.content.key) {
          <div
            [style.grid-column]="'span ' + item.columnSpan"
            [style.grid-row]="'span ' + item.rowSpan"
          >
            <ng-container *ngTemplateOutlet="element; context: { $implicit: item.content }" />
            @for (area of item.areas; track area.alias) {
              <div class="area">
                <ng-container *ngTemplateOutlet="grid; context: { $implicit: area.items }" />
              </div>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .refs {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.75rem;
      align-items: center;
    }
    .refs img {
      width: 100%;
      max-height: 520px;
      object-fit: cover;
      border-radius: 12px;
      display: block;
    }
    .text {
      display: grid;
      gap: 0.9rem;
      max-width: 72ch;
    }
    .text p {
      font-size: 1.05rem;
      line-height: 1.8;
    }
    .subheading {
      margin: 0.75rem 0 0;
      font-size: 1.35rem;
      line-height: 1.35;
      color: var(--heading);
    }
    .rte {
      max-width: 72ch;
      line-height: 1.8;
    }
    video {
      display: block;
      width: 100%;
      border-radius: 8px;
      background: #000;
    }
    /* Rich text is inserted via innerHTML, so its embeds need ::ng-deep to be styled. */
    .rte ::ng-deep iframe {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      border: 0;
      border-radius: 8px;
    }
    img {
      max-width: 100%;
      max-height: 320px;
      border-radius: 8px;
    }
    pre {
      background: var(--code-bg);
      padding: 0.75rem;
      border-radius: 6px;
      overflow: auto;
      font-size: 0.8rem;
    }
    p {
      margin: 0;
      white-space: pre-line;
    }
    .block {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }
    .block-prop {
      margin-top: 0.75rem;
    }
    h3 {
      font-size: 0.75rem;
      color: var(--muted);
      margin: 0 0 0.25rem;
      font-weight: 600;
    }
    .badge {
      font-size: 0.7rem;
      background: var(--accent-soft);
      color: var(--accent);
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
    }
    /* Umbraco's block grid defaults to 12 columns. */
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .area {
      margin-top: 0.75rem;
    }
  `,
})
export class PropertyValue {
  readonly value = input<unknown>();

  private readonly sanitizer = inject(DomSanitizer);

  /** Rich text; video embeds (YouTube/Vimeo iframes) are kept, see trustEmbeds(). */
  protected readonly html = computed<string | SafeHtml>(() =>
    trustEmbeds(String(this.value() ?? ''), this.sanitizer),
  );

  protected readonly hasValue = hasValue;
  protected readonly label = label;
  protected readonly keepOrder = keepOrder;

  /** Single values (e.g. a single content picker) are treated as a one-item list. */
  protected readonly asArray = computed(() => {
    const v = this.value();
    return Array.isArray(v) ? (v as unknown[]) : [v];
  });

  protected readonly kind = computed<Kind>(() => {
    const v = this.value();
    if (!hasValue(v)) return 'empty';
    if (typeof v === 'string') return v.trimStart().startsWith('<') ? 'html' : 'text';
    if (typeof v === 'number' || typeof v === 'boolean') return 'text';

    const items = this.asArray();
    if (items.every(isBlockGridItem)) return 'blockGrid';
    if (items.every(isBlockListItem)) return 'blockList';
    if (items.every(isElement)) return 'blockList'; // bare elements render like blocks
    if (items.every(isContentLink)) return 'refs';
    if (items.every(isLink)) return 'links';
    if (Array.isArray(v) && items.every((x) => typeof x === 'string' || typeof x === 'number'))
      return 'list';
    return 'json';
  });

  /**
   * Plain text split on blank lines into paragraphs. When there are several, a short
   * one-line paragraph without closing punctuation ("Visitor Guidelines") is a subheading.
   */
  protected readonly paragraphs = computed(() => {
    const parts = String(this.value() ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.map((text) => ({
      text,
      heading: parts.length > 1 && isHeadingLike(text),
    }));
  });

  protected readonly refs = computed(() => this.asArray() as ContentLink[]);
  protected readonly links = computed(() => this.asArray() as Link[]);
  protected readonly blockGrid = computed(() => this.asArray() as BlockGridItem[]);
  protected readonly blockList = computed<BlockListItem[]>(() =>
    this.asArray().map((x) =>
      isElement(x) ? { content: x, settings: null } : (x as BlockListItem),
    ),
  );

  protected isImage(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(url.split(/[?#]/)[0]);
  }

  protected isVideo(ref: ContentLink): boolean {
    return (
      /video/i.test(ref.contentType) ||
      /\.(mp4|webm|ogv|mov|m4v)$/i.test(ref.url.split(/[?#]/)[0])
    );
  }

  protected isMedia(url: string): boolean {
    return url.startsWith('/media/');
  }
}

function isHeadingLike(text: string): boolean {
  return text.length <= 60 && !text.includes('\n') && !/[.!?:;،؛؟…]$/.test(text);
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isElement(x: unknown): x is Element {
  return (
    isObject(x) &&
    typeof x['contentType'] === 'string' &&
    typeof x['key'] === 'string' &&
    isObject(x['properties'])
  );
}

function isContentLink(x: unknown): x is ContentLink {
  return (
    isObject(x) &&
    typeof x['id'] === 'number' &&
    typeof x['key'] === 'string' &&
    typeof x['url'] === 'string' &&
    !('properties' in x)
  );
}

function isLink(x: unknown): x is Link {
  return isObject(x) && typeof x['type'] === 'string' && 'url' in x && 'target' in x;
}

function isBlockListItem(x: unknown): x is BlockListItem {
  return isObject(x) && isElement(x['content']) && !('rowSpan' in x);
}

function isBlockGridItem(x: unknown): x is BlockGridItem {
  return isObject(x) && isElement(x['content']) && typeof x['rowSpan'] === 'number';
}

/** Hosts whose iframes may appear in rich text (Umbraco's "Embed" inserts these). */
const TRUSTED_EMBED_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
];

/**
 * Angular's default sanitizer strips every <iframe>, which removes Umbraco embeds.
 * When the HTML contains iframes, clean it ourselves — drop scripts, event handlers,
 * javascript: URLs and iframes from untrusted hosts — then mark the result as trusted.
 * Without iframes the plain string is returned and Angular sanitizes it as usual.
 */
function trustEmbeds(html: string, sanitizer: DomSanitizer): string | SafeHtml {
  if (!/<iframe/i.test(html) || typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, object, embed, base, meta, link, form').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const unsafeUrl =
        ['href', 'src', 'srcdoc', 'action', 'formaction', 'xlink:href'].includes(name) &&
        /^\s*(javascript|data|vbscript):/i.test(attr.value);
      if (name.startsWith('on') || name === 'srcdoc' || unsafeUrl) el.removeAttribute(attr.name);
    }
  });

  doc.querySelectorAll('iframe').forEach((frame) => {
    let host = '';
    try {
      const url = new URL(frame.getAttribute('src') ?? '', 'https://invalid.local');
      host = url.protocol === 'https:' ? url.hostname : '';
    } catch {
      // unparsable src -> removed below
    }
    if (!TRUSTED_EMBED_HOSTS.includes(host)) frame.remove();
    else frame.setAttribute('loading', 'lazy');
  });

  return sanitizer.bypassSecurityTrustHtml(doc.body.innerHTML);
}

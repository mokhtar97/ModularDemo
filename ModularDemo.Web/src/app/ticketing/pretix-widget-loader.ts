import { DOCUMENT, inject, Injectable } from '@angular/core';

/** What pretix's widget script puts on window. */
interface PretixWidgetGlobal {
  buildWidgets(): void;
}

type PretixWindow = Window & { PretixWidget?: PretixWidgetGlobal };

/**
 * Loads pretix's widget assets on demand — only when an <app-pretix-widget> is shown, never
 * from index.html — and each only once. Later callers share the same pending promise, so a
 * widget rendered while the script is still downloading just waits for it.
 */
@Injectable({ providedIn: 'root' })
export class PretixWidgetLoader {
  private readonly document = inject(DOCUMENT);
  private readonly styles = new Set<string>();
  private script?: Promise<void>;

  private get window(): PretixWindow | null {
    return this.document.defaultView as PretixWindow | null;
  }

  /** Whether the widget script has run (window.PretixWidget exists). */
  get ready(): boolean {
    return !!this.window?.PretixWidget;
  }

  /** Adds a widget stylesheet (one per event in pretix) the first time it's needed. */
  loadStyles(url: string): void {
    if (this.styles.has(url)) return;
    this.styles.add(url);
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.dataset['pretix'] = '';
    this.document.head.appendChild(link);
  }

  /**
   * Loads the widget script once. `urls` are tried in order (e.g. the Arabic file, then English)
   * until one loads. The script is global, so the first language loaded stays for the visit.
   */
  loadScript(urls: string[]): Promise<void> {
    if (this.ready) return Promise.resolve();
    this.script ??= this.tryUrls(urls).catch((error: unknown) => {
      this.script = undefined; // allow a retry on the next widget
      throw error;
    });
    return this.script;
  }

  /**
   * Turns every not-yet-built <pretix-widget> / <pretix-button> in the page into a widget.
   * Waits for a script that is still loading; does nothing if none was requested.
   */
  async build(): Promise<void> {
    if (this.script) {
      try {
        await this.script;
      } catch {
        return;
      }
    }
    this.window?.PretixWidget?.buildWidgets();
  }

  private async tryUrls(urls: string[]): Promise<void> {
    let lastError: unknown = new Error('No pretix widget script URL');
    for (const url of urls) {
      try {
        await this.inject(url);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private inject(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = url;
      script.async = true;
      script.dataset['pretix'] = '';
      script.onload = () =>
        this.ready ? resolve() : reject(new Error(`${url} did not define PretixWidget`));
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${url}`));
      };
      this.document.head.appendChild(script);
    });
  }
}

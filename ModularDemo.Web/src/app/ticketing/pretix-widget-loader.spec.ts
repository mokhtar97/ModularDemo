import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/core';
import { vi } from 'vitest';
import { PretixWidgetLoader } from './pretix-widget-loader';

type W = Window & { PretixWidget?: { buildWidgets(): void } };

describe('PretixWidgetLoader', () => {
  let loader: PretixWidgetLoader;
  let doc: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    loader = TestBed.inject(PretixWidgetLoader);
    doc = TestBed.inject(DOCUMENT);
    doc.head.querySelectorAll('[data-pretix]').forEach((el) => el.remove());
    delete (doc.defaultView as W).PretixWidget;
  });

  const scripts = () => [...doc.head.querySelectorAll<HTMLScriptElement>('script[data-pretix]')];

  it('adds each stylesheet only once', () => {
    loader.loadStyles('http://pretix/org/ev/widget/v1.css');
    loader.loadStyles('http://pretix/org/ev/widget/v1.css');
    expect(doc.head.querySelectorAll('link[data-pretix]').length).toBe(1);
  });

  it('injects the script once, shares the pending promise, and builds widgets after load', async () => {
    const first = loader.loadScript([
      'http://pretix/widget/v1.ar.js',
      'http://pretix/widget/v1.en.js',
    ]);
    const second = loader.loadScript(['http://pretix/widget/v1.ar.js']);
    expect(scripts().length).toBe(1);
    expect(scripts()[0].src).toBe('http://pretix/widget/v1.ar.js');

    const buildWidgets = vi.fn();
    (doc.defaultView as W).PretixWidget = { buildWidgets };
    scripts()[0].dispatchEvent(new Event('load'));
    await Promise.all([first, second]);

    await loader.build();
    expect(buildWidgets).toHaveBeenCalledTimes(1);
    await loader.loadScript(['http://pretix/widget/v1.ar.js']); // already loaded: no new tag
    expect(scripts().length).toBe(1);
  });

  it('falls back to the next URL when a language file fails', async () => {
    const done = loader.loadScript([
      'http://pretix/widget/v1.xx.js',
      'http://pretix/widget/v1.en.js',
    ]);
    scripts()[0].dispatchEvent(new Event('error'));
    await Promise.resolve();
    await Promise.resolve();
    expect(scripts().map((s) => s.src)).toEqual(['http://pretix/widget/v1.en.js']);

    (doc.defaultView as W).PretixWidget = { buildWidgets: vi.fn() };
    scripts()[0].dispatchEvent(new Event('load'));
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects when no URL loads, and allows a retry later', async () => {
    const done = loader.loadScript(['http://pretix/widget/v1.en.js']);
    scripts()[0].dispatchEvent(new Event('error'));
    await expect(done).rejects.toThrow();
    loader.loadScript(['http://pretix/widget/v1.en.js']).catch(() => undefined);
    expect(scripts().length).toBe(1); // a fresh attempt
  });
});

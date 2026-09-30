import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PretixWidget } from './pretix-widget';
import { PretixWidgetLoader } from './pretix-widget-loader';
import { PretixService } from './pretix.service';

const settings = { baseUrl: 'http://localhost:8345/', organizer: 'myorg', widgetVersion: 'v1' };

describe('PretixWidget', () => {
  let loader: {
    loadStyles: ReturnType<typeof vi.fn>;
    loadScript: ReturnType<typeof vi.fn>;
    build: ReturnType<typeof vi.fn>;
  };

  function setup(inputs: Record<string, unknown>, settings$ = of(settings), scriptFails = false) {
    loader = {
      loadStyles: vi.fn(),
      loadScript: scriptFails
        ? vi.fn().mockRejectedValue(new Error('offline'))
        : vi.fn().mockResolvedValue(undefined),
      build: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [PretixWidget],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PretixWidgetLoader, useValue: loader },
        { provide: PretixService, useValue: { settings: () => settings$ } },
      ],
    });
    const fixture = TestBed.createComponent(PretixWidget);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    TestBed.tick();
    return fixture;
  }

  it('renders <pretix-widget> for the default organizer and loads assets', async () => {
    const fixture = setup({ event: 'summer-2026' });
    const el = fixture.nativeElement.querySelector('pretix-widget');
    expect(el?.getAttribute('event')).toBe('http://localhost:8345/myorg/summer-2026/');
    expect(loader.loadStyles).toHaveBeenCalledWith(
      'http://localhost:8345/myorg/summer-2026/widget/v1.css',
    );
    expect(loader.loadScript).toHaveBeenCalledWith(['http://localhost:8345/widget/v1.en.js']);
    await Promise.resolve();
    expect(loader.build).toHaveBeenCalled();
  });

  it('renders <pretix-button> in button mode and uses the page organizer', () => {
    const fixture = setup({
      event: 'gala',
      organizer: 'other',
      mode: 'button',
      label: 'Get tickets',
    });
    const button = fixture.nativeElement.querySelector('pretix-button');
    expect(button?.getAttribute('event')).toBe('http://localhost:8345/other/gala/');
    expect(button?.textContent?.trim()).toBe('Get tickets');
    expect(fixture.nativeElement.querySelector('pretix-widget')).toBeNull();
  });

  it('shows a link to the shop when the script cannot load', async () => {
    const fixture = setup({ event: 'summer-2026' }, of(settings), true);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fallback a')?.getAttribute('href')).toBe(
      'http://localhost:8345/myorg/summer-2026/',
    );
  });

  it('explains when the settings cannot be loaded', () => {
    const fixture = setup({ event: 'x' }, throwError(() => new Error('503')) as never);
    expect(fixture.nativeElement.querySelector('pretix-widget')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('not available');
  });
});

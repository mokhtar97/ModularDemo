import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PropertyValue } from './property-value';

const element = (contentType: string, properties: Record<string, unknown>) => ({
  contentType,
  key: crypto.randomUUID(),
  properties,
});

function render(value: unknown): HTMLElement {
  const fixture = TestBed.createComponent(PropertyValue);
  fixture.componentRef.setInput('value', value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PropertyValue', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PropertyValue], providers: [provideRouter([])] });
  });

  it('renders plain text and rich text', () => {
    expect(render('Hello').querySelector('p')?.textContent).toBe('Hello');
    expect(render('<p><strong>Rich</strong></p>').querySelector('.rte strong')?.textContent).toBe(
      'Rich',
    );
  });

  it('splits long text into paragraphs and short standalone lines into subheadings', () => {
    const el = render(
      'We are happy to see you.\n\nVisitor Guidelines\n\nPlease keep the place clean.',
    );
    expect([...el.querySelectorAll('.text p')].map((p) => p.textContent)).toEqual([
      'We are happy to see you.',
      'Please keep the place clean.',
    ]);
    expect(el.querySelector('.text h2')?.textContent).toBe('Visitor Guidelines');
    expect(render('lion power').querySelector('h2')).toBeNull(); // a single line stays text
  });

  it('renders picked media as images and picked content as router links', () => {
    const el = render([
      { id: 1, key: 'a', name: 'Photo', contentType: 'Image', url: '/media/abc/photo.jpg' },
      { id: 2, key: 'b', name: 'About', contentType: 'page', url: '/about/' },
    ]);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/media/abc/photo.jpg');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/about');
  });

  it('treats a single picked item like a one-item list', () => {
    const el = render({ id: 2, key: 'b', name: 'About', contentType: 'page', url: '/about/' });
    expect(el.querySelector('a')?.textContent).toBe('About');
  });

  it('renders multi URL picker links, external ones with href and target', () => {
    const el = render([
      { name: 'Umbraco', url: 'https://umbraco.com', target: '_blank', type: 'External' },
    ]);
    const a = el.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://umbraco.com');
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('renders block list items recursively', () => {
    const el = render([{ content: element('heroBlock', { title: 'Welcome' }), settings: null }]);
    expect(el.querySelector('.block .badge')?.textContent).toBe('heroBlock');
    expect(el.querySelector('.block h3')?.textContent).toBe('Title');
    expect(el.querySelector('.block p')?.textContent).toBe('Welcome');
  });

  it('renders block grid items with spans and nested areas', () => {
    const el = render([
      {
        content: element('twoColumn', {}),
        settings: null,
        rowSpan: 1,
        columnSpan: 12,
        areas: [
          {
            alias: 'left',
            rowSpan: 1,
            columnSpan: 6,
            items: [
              {
                content: element('text', { body: 'Inside' }),
                settings: null,
                rowSpan: 1,
                columnSpan: 6,
                areas: [],
              },
            ],
          },
        ],
      },
    ]);
    const cell = el.querySelector<HTMLElement>('.grid > div')!;
    expect(cell.style.gridColumn).toBe('span 12');
    expect(el.querySelector('.area .block p')?.textContent).toBe('Inside');
  });

  it('falls back to JSON for unmapped values', () => {
    expect(render({ src: '/media/x.jpg', crops: [] }).querySelector('pre')).not.toBeNull();
  });
});

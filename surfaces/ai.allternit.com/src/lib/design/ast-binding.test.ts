import { describe, it, expect } from 'vitest';
import {
  locateElement,
  applyElementEdit,
  extractInnerText,
  AstElementNotFoundError,
} from './ast-binding';
import { injectAioIds } from './aio-targeting';

const DOC = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Demo</title>
  <style>.hero { color: red; }</style>
</head>
<body>
  <!-- a comment with a <div> inside -->
  <div class="hero" id='main'>
    <h1>Welcome</h1>
    <button id="buy">Buy now</button>
  </div>
  <p data-aio-id="aio-7">Pre-identified</p>
  <ul><li>One</li><li>Two</li></ul>
  <script>const el = document.createElement('div'); document.body.appendChild(el);</script>
</body>
</html>`;

// Effective ids under injectAioIds numbering for DOC:
//   maxExisting = 7; hero div → aio-8, h1 → aio-9, button → aio-10,
//   p keeps aio-7, ul → aio-11, li → aio-12/13.
const HERO_AIO = 'aio-8';
const H1_AIO = 'aio-9';
const BUTTON_AIO = 'aio-10';
const UL_AIO = 'aio-11';

describe('locateElement', () => {
  it('resolves ids exactly as injectAioIds assigns them', () => {
    const injected = injectAioIds(DOC);
    for (const [id, tag] of [
      [HERO_AIO, 'div'],
      [H1_AIO, 'h1'],
      [BUTTON_AIO, 'button'],
      ['aio-7', 'p'],
      [UL_AIO, 'ul'],
    ] as const) {
      const loc = locateElement(DOC, id);
      expect(loc?.tag, id).toBe(tag);
      // The same id resolves in the injected render with identical content.
      const locInjected = locateElement(injected, id);
      expect(locInjected?.tag, id).toBe(tag);
      expect(extractInnerText(DOC, loc!), id).toBe(extractInnerText(injected, locInjected!));
    }
  });

  it('returns tag, attrs, and inner range', () => {
    const loc = locateElement(DOC, HERO_AIO)!;
    expect(loc.tag).toBe('div');
    expect(loc.attrs.class).toBe('hero');
    expect(loc.attrs.id).toBe('main');
    expect(DOC.slice(loc.innerRange.start, loc.innerRange.end)).toContain('<h1>Welcome</h1>');
    expect(DOC.slice(loc.start, loc.openEnd)).toBe(`<div class="hero" id='main'>`);
  });

  it('nested elements resolve independently with correct ranges', () => {
    const hero = locateElement(DOC, HERO_AIO)!;
    const h1 = locateElement(DOC, H1_AIO)!;
    const button = locateElement(DOC, BUTTON_AIO)!;
    expect(h1.start).toBeGreaterThan(hero.innerRange.start);
    expect(h1.end).toBeLessThan(hero.innerRange.end);
    expect(button.start).toBeGreaterThan(h1.end);
  });

  it('duplicate ids: first match in document order wins', () => {
    const html = `<div><p data-aio-id="aio-3">first</p><span data-aio-id="aio-3">second</span></div>`;
    const loc = locateElement(html, 'aio-3')!;
    expect(html.slice(loc.start, loc.end)).toBe('<p data-aio-id="aio-3">first</p>');
  });

  it('returns null for unknown or malformed ids', () => {
    expect(locateElement(DOC, 'aio-999')).toBeNull();
    expect(locateElement(DOC, 'aio-x')).toBeNull();
    expect(locateElement(DOC, '../../etc')).toBeNull();
  });

  it('ignores tags inside script/style and comments', () => {
    // The `</div>` inside the inline script string must not close the hero div.
    const hero = locateElement(DOC, HERO_AIO)!;
    expect(DOC.slice(hero.innerRange.start, hero.innerRange.end)).toContain('<button');
    // No element is identified inside <style> or the comment.
    expect(locateElement(DOC, 'aio-5')).toBeNull();
  });

  it('handles pre-existing ids on elements injection skips (img)', () => {
    const html = `<div><img src="a.png" data-aio-id="aio-4" alt="pic"><span>x</span></div>`;
    const loc = locateElement(html, 'aio-4')!;
    expect(loc.tag).toBe('img');
    expect(loc.void).toBe(true);
    expect(loc.end).toBe(loc.openEnd);
  });
});

describe('applyElementEdit — byte preservation', () => {
  it('preserves everything outside the target element byte-for-byte', () => {
    const loc = locateElement(DOC, H1_AIO)!;
    const out = applyElementEdit(DOC, H1_AIO, { setText: 'Hello' });
    expect(out.slice(0, loc.start)).toBe(DOC.slice(0, loc.start));
    expect(out.slice(loc.end + ('<h1>Hello</h1>'.length - '<h1>Welcome</h1>'.length))).toBe(DOC.slice(loc.end));
    expect(out.length).toBe(DOC.length - 'Welcome'.length + 'Hello'.length);
  });

  it('setText replaces only the inner content and escapes HTML', () => {
    const out = applyElementEdit(DOC, H1_AIO, { setText: 'A < B & C' });
    expect(out).toContain('<h1>A &lt; B &amp; C</h1>');
    expect(out).toContain('<!-- a comment with a <div> inside -->');
  });

  it('does not touch siblings or parents when editing a nested element', () => {
    const out = applyElementEdit(DOC, BUTTON_AIO, { setText: 'Order' });
    // Prefix up to the button and everything from the button's closing tag
    // on are byte-identical; only the button's inner text changed.
    const button = locateElement(DOC, BUTTON_AIO)!;
    expect(out.slice(0, button.start)).toBe(DOC.slice(0, button.start));
    expect(out.slice(out.indexOf('</button>') + '</button>'.length))
      .toBe(DOC.slice(DOC.indexOf('</button>') + '</button>'.length));
    expect(out).toContain('<button id="buy">Order</button>');
    expect(out).toContain('<h1>Welcome</h1>');
  });
});

describe('applyElementEdit — attributes', () => {
  it('sets a new attribute with insertion before self-closing slash', () => {
    const html = `<div><br/><span>aio</span></div>`;
    const injected = injectAioIds(html);
    const spanId = injected.match(/<span data-aio-id="(aio-\d+)">/)![1];
    const out = applyElementEdit(injected, spanId, { setAttributes: { 'data-x': '1' } });
    expect(out).toContain(`<span data-aio-id="${spanId}" data-x="1">aio</span>`);
    expect(out).toContain('<br/>');
  });

  it('replaces an existing attribute value preserving quote style', () => {
    const out = applyElementEdit(DOC, HERO_AIO, { setAttributes: { id: 'hero-2' } });
    expect(out).toContain(`id='hero-2'`);
    expect(out).not.toContain(`id='main'`);
  });

  it('removes an attribute including its leading whitespace', () => {
    const out = applyElementEdit(DOC, HERO_AIO, { removeAttributes: ['class'] });
    expect(out).toContain(`<div id='main'>`);
    expect(out).not.toContain('class="hero"');
  });

  it('setAttributes with null removes, missing removals are no-ops', () => {
    const out = applyElementEdit(DOC, HERO_AIO, {
      setAttributes: { class: null },
      removeAttributes: ['nonexistent'],
    });
    expect(out).toContain(`<div id='main'>`);
  });

  it('handles attributes containing > and lookalike data-aio-id in values', () => {
    const html = `<div title="a > b" data-note='data-aio-id="fake"'><span>x</span></div>`;
    const injected = injectAioIds(html);
    const divId = injected.match(/data-aio-id="(aio-\d+)"/)![1];
    const loc = locateElement(html, divId)!;
    expect(loc.attrs.title).toBe('a > b');
    const out = applyElementEdit(html, divId, { setAttributes: { title: 'c > d' } });
    expect(out).toContain('title="c > d"');
  });

  it('turns a valueless attribute into a valued one', () => {
    const html = `<div><button disabled>ok</button></div>`;
    const injected = injectAioIds(html);
    const id = injected.match(/<button[^>]*data-aio-id="(aio-\d+)"/)![1];
    const out = applyElementEdit(injected, id, { setAttributes: { disabled: 'disabled' } });
    expect(out).toContain('disabled="disabled"');
  });

  it('rejects invalid attribute names', () => {
    expect(() => applyElementEdit(DOC, HERO_AIO, { setAttributes: { 'bad name': 'x' } })).toThrow();
  });

  it('edits attributes on void elements without touching content', () => {
    const html = `<div><img src="a.png"><span>x</span></div>`;
    const injected = injectAioIds(html);
    const loc = locateElement(html, 'aio-1')!;
    expect(loc.tag).toBe('div');
    const imgDoc = `<div><img src="a.png" data-aio-id="aio-2"><span>x</span></div>`;
    const out = applyElementEdit(imgDoc, 'aio-2', { setAttributes: { alt: 'pic' } });
    expect(out).toBe(`<div><img src="a.png" data-aio-id="aio-2" alt="pic"><span>x</span></div>`);
  });
});

describe('applyElementEdit — inner HTML', () => {
  it('replaces inner HTML verbatim', () => {
    const out = applyElementEdit(DOC, UL_AIO, { innerHtml: '<li>Solo</li>' });
    expect(out).toContain('<ul><li>Solo</li></ul>');
  });

  it('throws when both innerHtml and setText are given', () => {
    expect(() => applyElementEdit(DOC, H1_AIO, { innerHtml: 'x', setText: 'y' })).toThrow();
  });

  it('throws AstElementNotFoundError for unknown ids', () => {
    expect(() => applyElementEdit(DOC, 'aio-999', { setText: 'x' })).toThrow(AstElementNotFoundError);
  });

  it('content edits on void elements are attribute-only no-ops on content', () => {
    const html = `<div><img src="a.png" data-aio-id="aio-2"><span>x</span></div>`;
    const out = applyElementEdit(html, 'aio-2', { setText: 'ignored' });
    expect(out).toBe(html);
  });
});

describe('applyElementEdit — idempotency', () => {
  it('setText is idempotent', () => {
    const once = applyElementEdit(DOC, H1_AIO, { setText: 'Hello' });
    const twice = applyElementEdit(once, H1_AIO, { setText: 'Hello' });
    expect(twice).toBe(once);
  });

  it('setAttributes is idempotent', () => {
    const edit = { setAttributes: { 'data-x': 'a"b', id: 'z' } };
    const once = applyElementEdit(DOC, HERO_AIO, edit);
    const twice = applyElementEdit(once, HERO_AIO, edit);
    expect(twice).toBe(once);
  });

  it('removeAttributes is idempotent', () => {
    const once = applyElementEdit(DOC, HERO_AIO, { removeAttributes: ['class'] });
    const twice = applyElementEdit(once, HERO_AIO, { removeAttributes: ['class'] });
    expect(twice).toBe(once);
  });

  it('innerHtml is idempotent', () => {
    const once = applyElementEdit(DOC, UL_AIO, { innerHtml: '<li>Solo</li>' });
    const twice = applyElementEdit(once, UL_AIO, { innerHtml: '<li>Solo</li>' });
    expect(twice).toBe(once);
  });

  it('mixed attribute + content edit is idempotent', () => {
    const edit = { setAttributes: { class: 'hero big' }, setText: 'Hi' };
    const once = applyElementEdit(DOC, H1_AIO, edit);
    const twice = applyElementEdit(once, H1_AIO, edit);
    expect(twice).toBe(once);
  });
});

describe('applyElementEdit — script/style untouched', () => {
  it('editing an element after a script does not corrupt the script', () => {
    const out = applyElementEdit(DOC, 'aio-7', { setText: 'Re-identified' });
    const marker = 'const el = document.createElement';
    expect(out.slice(out.indexOf(marker))).toBe(DOC.slice(DOC.indexOf(marker)));
  });

  it('editing the element right before a style block preserves the style', () => {
    const html = `<head><title>T</title><style>.a{content:"</p>"}</style></head><body><p>x</p></body>`;
    const injected = injectAioIds(html);
    const pId = injected.match(/<p data-aio-id="(aio-\d+)">/)![1];
    const out = applyElementEdit(injected, pId, { setText: 'y' });
    expect(out).toContain('.a{content:"</p>"}');
    expect(out).toContain('<p data-aio-id="');
  });
});

describe('applyElementEdit — structural edge cases', () => {
  it('handles unquoted and valueless attributes', () => {
    const html = `<div><a href=/foo target=_blank rel>link</a></div>`;
    const injected = injectAioIds(html);
    const id = injected.match(/<a[^>]*data-aio-id="(aio-\d+)"/)![1];
    const out = applyElementEdit(html, id, { setAttributes: { rel: 'noopener' } });
    expect(out).toContain('rel="noopener"');
  });

  it('handles self-closing custom elements', () => {
    const html = `<div><widget data-x="1" /><span>after</span></div>`;
    const injected = injectAioIds(html);
    const id = injected.match(/<widget[^>]*data-aio-id="(aio-\d+)"/)![1];
    const loc = locateElement(html, id)!;
    expect(loc.selfClosing).toBe(true);
    const out = applyElementEdit(html, id, { setAttributes: { 'data-y': '2' } });
    expect(out).toContain(`<widget data-x="1" data-y="2"/>`);
    expect(out).toContain('<span>after</span>');
  });

  it('handles fragments without html/head/body', () => {
    const html = `<div><p>hi</p></div>`;
    const out = applyElementEdit(html, 'aio-2', { setText: 'bye' });
    expect(out).toBe(`<div><p>bye</p></div>`);
  });

  it('implicitly closed elements end where the next same-tag sibling starts', () => {
    // Numbering: div → aio-1 (divs are targetable), first p → aio-2.
    const html = `<div><p>one<p>two</div>`;
    const loc = locateElement(html, 'aio-2')!;
    expect(html.slice(loc.start, loc.end)).toBe('<p>one');
    const out = applyElementEdit(html, 'aio-2', { setText: 'ONE' });
    expect(out).toBe('<div><p>ONE<p>two</div>');
  });

  it('li autoclose: editing the first li does not swallow the second', () => {
    // Numbering: ul → aio-1, first li → aio-2.
    const html = `<ul><li>One<li>Two</ul>`;
    const out = applyElementEdit(html, 'aio-2', { setText: 'Uno' });
    expect(out).toBe('<ul><li>Uno<li>Two</ul>');
  });

  it('same-tag divs nest normally (no autoclose)', () => {
    const html = `<div><div>inner</div></div>`;
    const out = applyElementEdit(html, 'aio-2', { setText: 'changed' });
    expect(out).toBe(`<div><div>changed</div></div>`);
    const outer = locateElement(html, 'aio-1')!;
    expect(html.slice(outer.start, outer.end)).toBe(html);
  });
});

describe('extractInnerText', () => {
  it('strips tags and decodes basic entities', () => {
    const loc = locateElement(DOC, HERO_AIO)!;
    const text = extractInnerText(DOC, loc);
    expect(text).toContain('Welcome');
    expect(text).toContain('Buy now');
    expect(text).not.toContain('<h1>');
  });
});

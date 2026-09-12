import { describe, it, expect } from 'vitest';
import {
  injectAioIds,
  injectAioTargetCapture,
  parseAioTargetMessage,
  buildAioTargetDescription,
  AIO_TARGET_SOURCE,
} from './aio-targeting';
import { buildSurgicalEditPrompt, type SurgicalComment } from './surgical-edit';

const DOC = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Demo</title>
  <script src="https://example.com/lib.js"></script>
  <style>.hero { color: red; }</style>
</head>
<body>
  <!-- a comment with a <div> inside -->
  <div class="hero">
    <h1>Welcome</h1>
    <button id="buy">Buy now</button>
  </div>
  <p data-aio-id="aio-7">Pre-identified</p>
  <ul><li>One</li><li>Two</li></ul>
  <script>const el = document.createElement('div'); document.body.appendChild(el);</script>
</body>
</html>`;

describe('injectAioIds', () => {
  it('adds deterministic document-order ids to elements lacking them', () => {
    const out = injectAioIds(DOC);
    const ids = [...out.matchAll(/data-aio-id="(aio-\d+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    // Newly-assigned ids strictly increase in document order (an element that
    // already carried an id keeps it, so the full sequence need not increase).
    const newIds = ids.filter((id) => id !== 'aio-7');
    const nums = newIds.map((id) => Number(id.slice(4)));
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
    // Existing id preserved and numbering continues after it.
    expect(out).toContain('data-aio-id="aio-7"');
    expect(ids).toContain('aio-8');
  });

  it('is idempotent on already-injected HTML', () => {
    const once = injectAioIds(DOC);
    const twice = injectAioIds(once);
    expect(twice).toBe(once);
  });

  it('is deterministic: same input → same output', () => {
    expect(injectAioIds(DOC)).toBe(injectAioIds(DOC));
  });

  it('preserves existing ids and does not renumber them', () => {
    const out = injectAioIds(DOC);
    expect(out.match(/data-aio-id="aio-7"/g)?.length).toBe(1);
  });

  it('never tags inside script/style/textarea/title or comments', () => {
    const out = injectAioIds(DOC);
    // The <div> inside the inline script string must not be tagged.
    expect(out).toContain(`document.createElement('div')`);
    expect(out).not.toContain(`createElement('div' data-aio-id`);
    // The <div> inside the HTML comment must not be tagged.
    expect(out.match(/<!-- a comment with a <div> inside -->/)).not.toBeNull();
    // No id inside <style>.
    const styleBlock = out.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    expect(styleBlock).not.toContain('data-aio-id');
  });

  it('skips void/head elements (meta, link, img, input)', () => {
    const html = `<html><head><meta charset="utf-8"><link rel="x" href="y"></head><body><img src="a.png"><input type="text"><span>hi</span></body></html>`;
    const out = injectAioIds(html);
    expect(out.match(/<meta[^>]*data-aio-id/g)).toBeNull();
    expect(out.match(/<link[^>]*data-aio-id/g)).toBeNull();
    expect(out.match(/<img[^>]*data-aio-id/g)).toBeNull();
    expect(out.match(/<input[^>]*data-aio-id/g)).toBeNull();
    expect(out).toContain('<span data-aio-id="aio-1">hi</span>');
  });

  it('handles attributes containing > and quoted data-aio-id lookalikes', () => {
    const html = `<div title="a > b" data-note='data-aio-id="fake"'><span>x</span></div>`;
    const out = injectAioIds(html);
    expect(out).toContain('title="a > b"');
    expect(out.match(/data-aio-id="aio-\d+"/g)?.length).toBe(2);
  });

  it('handles fragments without html/head/body', () => {
    const out = injectAioIds(`<div><p>hi</p></div>`);
    expect(out).toContain('<div data-aio-id="aio-1">');
    expect(out).toContain('<p data-aio-id="aio-2">hi</p>');
  });
});

describe('injectAioTargetCapture', () => {
  it('injects the capture script before </body>', () => {
    const out = injectAioTargetCapture('<html><body><p>x</p></body></html>');
    expect(out).toContain('data-allternit-aio-target-capture');
    expect(out.indexOf('data-allternit-aio-target-capture')).toBeLessThan(out.indexOf('</body>'));
  });

  it('is idempotent', () => {
    const once = injectAioTargetCapture('<p>x</p>');
    expect(injectAioTargetCapture(once)).toBe(once);
  });
});

describe('parseAioTargetMessage', () => {
  it('accepts a well-formed payload', () => {
    const payload = parseAioTargetMessage({ source: AIO_TARGET_SOURCE, aioId: 'aio-12', tag: 'button', text: 'Buy now' });
    expect(payload).toEqual({ aioId: 'aio-12', tag: 'button', text: 'Buy now' });
  });

  it('rejects wrong source', () => {
    expect(parseAioTargetMessage({ source: 'evil', aioId: 'aio-1', tag: 'div', text: '' })).toBeNull();
  });

  it('rejects malformed aioId', () => {
    expect(parseAioTargetMessage({ source: AIO_TARGET_SOURCE, aioId: '../../../etc', tag: 'div', text: '' })).toBeNull();
    expect(parseAioTargetMessage({ source: AIO_TARGET_SOURCE, aioId: 'aio-x', tag: 'div', text: '' })).toBeNull();
    expect(parseAioTargetMessage({ source: AIO_TARGET_SOURCE, tag: 'div', text: '' })).toBeNull();
  });

  it('rejects malformed tag and text', () => {
    expect(parseAioTargetMessage({ source: AIO_TARGET_SOURCE, aioId: 'aio-1', tag: '<script>', text: '' })).toBeNull();
    expect(parseAioTargetMessage({ source: AIO_TARGET_SOURCE, aioId: 'aio-1', tag: 'div', text: 42 })).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(parseAioTargetMessage(null)).toBeNull();
    expect(parseAioTargetMessage('string')).toBeNull();
    expect(parseAioTargetMessage([AIO_TARGET_SOURCE])).toBeNull();
  });
});

describe('buildAioTargetDescription', () => {
  it('formats tag, text snippet, and id', () => {
    expect(buildAioTargetDescription({ aioId: 'aio-12', tag: 'button', text: 'Buy now' }))
      .toBe('<button> "Buy now" (aio-12)');
  });

  it('omits empty text', () => {
    expect(buildAioTargetDescription({ aioId: 'aio-3', tag: 'svg', text: '' }))
      .toBe('<svg> (aio-3)');
  });
});

describe('surgical prompt with an aio target', () => {
  it('includes the element description in the built prompt', () => {
    const payload = { aioId: 'aio-12', tag: 'button', text: 'Buy now' };
    const comment: SurgicalComment = {
      id: 'comment-1',
      target: buildAioTargetDescription(payload),
      body: 'make this 48px and use the accent color',
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    const prompt = buildSurgicalEditPrompt('<html></html>', [comment]);
    // The element description rides in the comment target (serialized quotes
    // inside the attribute are the pre-existing serializer behavior).
    expect(prompt).toContain('target="<button> ');
    expect(prompt).toContain('Buy now');
    expect(prompt).toContain('(aio-12)');
    expect(prompt).toContain('make this 48px');
  });
});

import { describe, expect, it } from 'vitest';
import { extractTurnImages } from './turn-images';

const DATA_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
const DATA_JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

describe('extractTurnImages', () => {
  it('returns an empty list for no messages', () => {
    expect(extractTurnImages([])).toEqual([]);
  });

  it('ignores user messages', () => {
    const out = extractTurnImages([
      { role: 'user', content: `![x](${DATA_PNG})` },
    ]);
    expect(out).toEqual([]);
  });

  it('extracts image artifact blocks and wraps bare base64', () => {
    const out = extractTurnImages([
      {
        role: 'assistant',
        content:
          '<artifact type="image/png" identifier="hero">aGVsbG8gd29ybGQ=</artifact>' +
          '<artifact type="text/html" identifier="page"><html></html></artifact>',
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('artifact');
    expect(out[0].url).toBe('data:image/png;base64,aGVsbG8gd29ybGQ=');
  });

  it('keeps already-encoded data URLs in artifacts', () => {
    const out = extractTurnImages([
      { role: 'assistant', content: `<artifact type="image/jpeg" identifier="a">${DATA_JPG}</artifact>` },
    ]);
    expect(out[0].url).toBe(DATA_JPG);
  });

  it('extracts markdown image embeds with http and data URLs', () => {
    const out = extractTurnImages([
      { role: 'assistant', content: 'Here you go:\n![hero](https://cdn.example.com/hero.png)\n![alt](\n  ' + DATA_PNG + '\n)' },
    ]);
    expect(out.map((o) => o.url)).toEqual([
      'https://cdn.example.com/hero.png',
      DATA_PNG,
    ]);
    expect(out.every((o) => o.source === 'markdown')).toBe(true);
  });

  it('extracts images from image-tool agentElementsParts', () => {
    const out = extractTurnImages([
      {
        role: 'assistant',
        content: 'Generated the hero image.',
        metadata: {
          agentElementsParts: [
            {
              type: 'tool-generate_image',
              toolCallId: 'call-1',
              input: { prompt: 'a hero' },
              result: { url: 'https://cdn.example.com/generated/hero.png' },
            },
            {
              type: 'tool-write_file',
              toolCallId: 'call-2',
              result: { path: 'index.html' },
            },
          ],
        },
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('tool');
    expect(out[0].url).toBe('https://cdn.example.com/generated/hero.png');
  });

  it('prefers data URLs over http URLs inside a tool part', () => {
    const out = extractTurnImages([
      {
        role: 'assistant',
        content: '',
        metadata: {
          agentElementsParts: [
            {
              type: 'tool-generate_image',
              result: { image: DATA_PNG, url: 'https://cdn.example.com/x.png' },
            },
          ],
        },
      },
    ]);
    expect(out[0].url).toBe(DATA_PNG);
  });

  it('skips blob: and file: URLs', () => {
    const out = extractTurnImages([
      { role: 'assistant', content: '![a](blob:http://localhost/1234) ![b](file:///tmp/x.png)' },
    ]);
    expect(out).toEqual([]);
  });

  it('dedupes the same image across artifact and markdown', () => {
    const out = extractTurnImages([
      {
        role: 'assistant',
        content: `<artifact type="image/png" identifier="a">${DATA_PNG.replace('data:image/png;base64,', '')}</artifact>![same](${DATA_PNG})`,
      },
    ]);
    expect(out).toHaveLength(1);
  });

  it('orders most recent assistant message first and caps at 6', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: 'assistant',
      content: `<artifact type="image/png" identifier="img-${i}">${i}</artifact>`,
    }));
    const out = extractTurnImages(messages);
    expect(out).toHaveLength(6);
    // Message 9 is last (most recent) and is scanned first.
    expect(out[0].url).toContain('base64,9');
  });

  it('never throws on malformed messages', () => {
    const out = extractTurnImages([
      { role: 'assistant' },
      { role: 'assistant', content: 42 as unknown as string },
      { role: 'assistant', content: 'x', metadata: { agentElementsParts: 'nope' as unknown as [] } },
      null as unknown as { role: string },
    ]);
    expect(out).toEqual([]);
  });
});

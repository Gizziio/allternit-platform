import { describe, expect, it } from 'vitest';

import { buildThumbnailSvg } from './artifact-thumbnail';

const ARTIFACT = `<!doctype html>
<html>
<head>
  <style>body { margin: 0; font-family: serif; } h1 { color: #1a1a1a; }</style>
  <link rel="stylesheet" href="https://external.example/never-fetch.css" />
</head>
<body><main><h1>Acme</h1><p>Hello</p></main></body>
</html>`;

describe('buildThumbnailSvg', () => {
  it('wraps body content in a sized foreignObject svg', () => {
    const svg = buildThumbnailSvg(ARTIFACT, 640, 480);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">')).toBe(true);
    expect(svg).toContain('<foreignObject width="100%" height="100%">');
    expect(svg).toContain('width:640px;height:480px;overflow:hidden');
    expect(svg).toContain('<h1>Acme</h1>');
  });

  it('inlines <style> blocks but never references external stylesheets', () => {
    const svg = buildThumbnailSvg(ARTIFACT);
    expect(svg).toContain('font-family: serif;');
    expect(svg).not.toContain('never-fetch.css');
    expect(svg).not.toContain('<link');
  });

  it('renders empty artifacts without throwing', () => {
    const svg = buildThumbnailSvg('<html><head></head><body></body></html>');
    expect(svg).toContain('<foreignObject');
    expect(svg).not.toContain('undefined');
  });
});

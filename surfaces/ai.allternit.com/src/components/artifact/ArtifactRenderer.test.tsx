import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ArtifactRenderer, { injectSandboxStorageShim } from './ArtifactRenderer';

describe('artifact sandbox policy', () => {
  it('never grants allow-same-origin, for any artifact type', () => {
    const types = [
      'document/html',
      'code/react',
      'image/svg+xml',
      'media/svg',
      'text/markdown',
      'document/markdown',
      'application/lobe.artifacts.mermaid',
      'unknown/thing',
    ];
    for (const type of types) {
      const markup = renderToStaticMarkup(
        <ArtifactRenderer content={type.includes('svg') ? '<svg/>' : '# hi'} type={type} />,
      );
      if (markup.includes('sandbox=')) {
        expect(markup).toContain('sandbox="allow-scripts allow-forms allow-modals"');
        expect(markup).not.toContain('allow-same-origin');
      }
    }
  });

  // SVG and markdown renderers once injected markup into the host document via
  // dangerouslySetInnerHTML. Both must now route through the sandboxed iframe.
  it('renders SVG and markdown inside the sandboxed iframe, not the host document', () => {
    const svg = renderToStaticMarkup(<ArtifactRenderer content={'<svg onload="x()"/>'} type="image/svg+xml" />);
    expect(svg).toContain('<iframe');
    expect(svg).not.toContain('dangerouslySetInnerHTML');

    const md = renderToStaticMarkup(<ArtifactRenderer content={'# hi <script>x</script>'} type="text/markdown" />);
    expect(md).toContain('<iframe');
  });

  it('storage shim injects into head and is idempotent', () => {
    const html = '<html><head><title>t</title></head><body></body></html>';
    const injected = injectSandboxStorageShim(html);
    expect(injected).toContain('data-allternit-artifact-storage-shim');
    expect(injected.indexOf('data-allternit-artifact-storage-shim')).toBeLessThan(injected.indexOf('<title>'));
    expect(injectSandboxStorageShim(injected)).toBe(injected);
  });

  it('storage shim wraps content with no head or html tag', () => {
    const injected = injectSandboxStorageShim('<p>loose</p>');
    expect(injected.startsWith('<script data-allternit-artifact-storage-shim>')).toBe(true);
  });
});

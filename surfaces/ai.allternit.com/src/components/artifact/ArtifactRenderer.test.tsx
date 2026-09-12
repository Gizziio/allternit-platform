import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ArtifactRenderer, {
  ARTIFACT_CSP,
  injectSandboxCsp,
  injectSandboxStorageShim,
} from './ArtifactRenderer';

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
      'application/vnd.allternit.deck',
      'application/vnd.allternit.prototype',
      'application/vnd.allternit.mobile',
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

describe('artifact CSP (issue #396)', () => {
  it('policy denies network egress and external origins outright', () => {
    expect(ARTIFACT_CSP).toContain("default-src 'none'");
    expect(ARTIFACT_CSP).toContain("connect-src 'none'");
    expect(ARTIFACT_CSP).toContain("form-action 'none'");
    expect(ARTIFACT_CSP).toContain("base-uri 'none'");
    // No scheme/source that would allow remote loads anywhere in the policy.
    expect(ARTIFACT_CSP).not.toContain('http:');
    expect(ARTIFACT_CSP).not.toContain('https:');
    expect(ARTIFACT_CSP).not.toContain("'self'");
    // Inline scripts/styles stay allowed (artifact JS is inline by design).
    expect(ARTIFACT_CSP).toContain("script-src 'unsafe-inline'");
    expect(ARTIFACT_CSP).toContain("style-src 'unsafe-inline'");
  });

  it('injects the CSP meta into head, before any artifact content', () => {
    const html = '<html><head><title>t</title><script>alert(1)</script></head><body><p>x</p></body></html>';
    const injected = injectSandboxCsp(html);
    expect(injected).toContain('http-equiv="Content-Security-Policy"');
    expect(injected).toContain('data-allternit-artifact-csp');
    expect(injected.indexOf('Content-Security-Policy')).toBeLessThan(injected.indexOf('<title>'));
    expect(injected.indexOf('Content-Security-Policy')).toBeLessThan(injected.indexOf('alert(1)'));
    expect(injectSandboxCsp(injected)).toBe(injected);
  });

  it('wraps fragment content with no head or html tag in a head carrying the CSP', () => {
    const injected = injectSandboxCsp('<p>loose</p>');
    expect(injected.startsWith('<head><meta http-equiv="Content-Security-Policy"')).toBe(true);
  });

  it('every iframe-rendering artifact type gets the CSP in its srcdoc', () => {
    const types = ['document/html', 'code/react', 'image/svg+xml', 'media/svg', 'text/markdown', 'document/markdown', 'unknown/thing'];
    for (const type of types) {
      const markup = renderToStaticMarkup(
        <ArtifactRenderer content={type.includes('svg') ? '<svg/>' : '# hi'} type={type} />,
      );
      if (markup.includes('srcdoc=')) {
        expect(markup).toContain('Content-Security-Policy');
        expect(markup).toContain("default-src 'none'");
        expect(markup).toContain("connect-src 'none'");
      }
    }
  });

  it('aio targeting keeps the CSP alongside the capture script (postMessage is unaffected by connect-src)', () => {
    const markup = renderToStaticMarkup(
      <ArtifactRenderer content={'<button>Buy</button>'} type="document/html" aioTargeting onAioTarget={() => {}} />,
    );
    expect(markup).toContain('Content-Security-Policy');
    expect(markup).toContain('data-allternit-aio-target-capture');
    expect(markup).toContain('data-allternit-artifact-storage-shim');
  });
});

describe('typed renderers (§2.1 Phase 2)', () => {
  it('deck renders slide chrome over the sandboxed iframe', () => {
    const markup = renderToStaticMarkup(
      <ArtifactRenderer content={'<deck-stage><section>s1</section></deck-stage>'} type="application/vnd.allternit.deck" />,
    );
    expect(markup).toContain('artifact-deck-renderer');
    expect(markup).toContain('sandbox="allow-scripts allow-forms allow-modals"');
    expect(markup).not.toContain('allow-same-origin');
    expect(markup).toContain('Content-Security-Policy');
  });

  it('mobile renders a 390px device frame in the sandboxed iframe', () => {
    const markup = renderToStaticMarkup(
      <ArtifactRenderer content={'<html><body>app</body></html>'} type="application/vnd.allternit.mobile" />,
    );
    expect(markup).toContain('artifact-mobile-renderer');
    expect(markup).toContain('sandbox="allow-scripts allow-forms allow-modals"');
    expect(markup).toContain('Content-Security-Policy');
    expect(markup).toContain('390px device frame');
  });

  it('prototype renders in the standard sandboxed iframe', () => {
    const markup = renderToStaticMarkup(
      <ArtifactRenderer content={'<html><body>proto</body></html>'} type="application/vnd.allternit.prototype" />,
    );
    expect(markup).toContain('sandbox="allow-scripts allow-forms allow-modals"');
    expect(markup).not.toContain('allow-same-origin');
  });
});

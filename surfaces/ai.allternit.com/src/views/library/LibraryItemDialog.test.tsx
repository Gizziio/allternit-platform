import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { WebsitePreview } from './LibraryItemDialog';
import type { LibraryItem } from '@/services/library-api';

function websiteItem(content: string, url?: string): LibraryItem {
  return {
    id: 'lib_1',
    kind: 'document',
    title: 'Smoke page',
    content,
    url,
    created_at: new Date().toISOString(),
  } as LibraryItem;
}

describe('LibraryItemDialog website preview CSP (same gap class as #396)', () => {
  const artifact = '<html><head><title>t</title></head><body><p>hi</p></body></html>';

  it('srcdoc carries the artifact CSP meta plus the storage shim', () => {
    const markup = renderToStaticMarkup(<WebsitePreview item={websiteItem(artifact)} />);
    expect(markup).toContain('srcDoc=');
    expect(markup).toContain('http-equiv=&quot;Content-Security-Policy&quot;');
    expect(markup).toContain('data-allternit-artifact-csp');
    expect(markup).toContain("default-src &#x27;none&#x27;");
    expect(markup).toContain('data-allternit-artifact-storage-shim');
  });

  it('CSP meta precedes the artifact body inside the srcdoc', () => {
    const markup = renderToStaticMarkup(<WebsitePreview item={websiteItem(artifact)} />);
    expect(markup.indexOf('Content-Security-Policy')).toBeLessThan(markup.indexOf('&lt;p&gt;hi&lt;/p&gt;'));
  });

  it('srcdoc iframe never grants allow-same-origin', () => {
    const markup = renderToStaticMarkup(<WebsitePreview item={websiteItem(artifact)} />);
    expect(markup).toContain('sandbox=');
    expect(markup).not.toContain('allow-same-origin');
  });

  it('fragment content with no head still gets the CSP', () => {
    const markup = renderToStaticMarkup(<WebsitePreview item={websiteItem('<p>loose</p>')} />);
    expect(markup).toContain('data-allternit-artifact-csp');
  });

  it('remote-url items render an iframe src and no srcdoc', () => {
    const markup = renderToStaticMarkup(
      <WebsitePreview item={websiteItem(artifact, 'https://example.com/page')} />,
    );
    expect(markup).toContain('src=');
    expect(markup).not.toContain('srcdoc=');
  });
});

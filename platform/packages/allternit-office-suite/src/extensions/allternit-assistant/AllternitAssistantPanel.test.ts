import { beforeEach, describe, expect, it } from 'vitest';
import { buildAssistantContext } from './AllternitAssistantPanel';
import { registerActiveDocument, reportActiveDocument } from '../activeDocument';

describe('buildAssistantContext', () => {
  beforeEach(() => {
    registerActiveDocument('docs', null);
    reportActiveDocument('docs', null);
    registerActiveDocument('pdf', null);
    reportActiveDocument('pdf', null);
  });

  it('reports when no document is open', () => {
    expect(buildAssistantContext('docs', 'Docs')).toBe(
      'No document is currently open in Allternit Docs.',
    );
  });

  it('names the open document from the prop registration', () => {
    registerActiveDocument('docs', 'Report.docx');
    expect(buildAssistantContext('docs', 'Docs')).toBe(
      'The user currently has "Report.docx" open in Allternit Docs.',
    );
  });

  it('includes the live document content when the app reports it', () => {
    // Regression: an in-app-created document (blank Untitled.docx) never
    // reached the registry, so the assistant claimed nothing was open.
    reportActiveDocument('docs', {
      name: 'Untitled.docx',
      content: () => 'Quarterly plan: ship the assistant fix.',
    });
    const context = buildAssistantContext('docs', 'Docs');
    expect(context).toContain('"Untitled.docx" open in Allternit Docs');
    expect(context).toContain('Current document content:');
    expect(context).toContain('Quarterly plan');
  });

  it('truncates oversized content', () => {
    reportActiveDocument('docs', {
      name: 'Big.docx',
      content: () => 'x'.repeat(10_000),
    });
    const context = buildAssistantContext('docs', 'Docs');
    expect(context.length).toBeLessThan(4_600);
    expect(context).toContain('truncated');
  });

  it('tolerates a throwing content getter', () => {
    reportActiveDocument('docs', {
      name: 'Broken.docx',
      content: () => {
        throw new Error('no engine');
      },
    });
    expect(buildAssistantContext('docs', 'Docs')).toBe(
      'The user currently has "Broken.docx" open in Allternit Docs.',
    );
  });

  it('includes extracted PDF text in the pdf context', () => {
    // The pdf renderer reports its open file with the extracted text so the
    // agent can answer questions about the document (PR #188 registry).
    reportActiveDocument('pdf', {
      name: 'report.pdf',
      content: () => 'Hello Allternit PDF',
    });
    const context = buildAssistantContext('pdf', 'PDF');
    expect(context).toContain('"report.pdf" open in Allternit PDF');
    expect(context).toContain('Current document content:');
    expect(context).toContain('Hello Allternit PDF');
  });

  it('allows a larger excerpt cap for PDFs', () => {
    // PDFs are read-only and page-oriented: 6000 chars fits under the 8000
    // pdf cap but over the 4000 default — docs would truncate, pdf must not.
    const body = `${'x'.repeat(6000)}TAILMARKER`;
    reportActiveDocument('pdf', { name: 'big.pdf', content: () => body });
    const pdfContext = buildAssistantContext('pdf', 'PDF');
    expect(pdfContext).toContain('TAILMARKER');
    expect(pdfContext).not.toContain('truncated');

    reportActiveDocument('docs', { name: 'big.docx', content: () => body });
    const docsContext = buildAssistantContext('docs', 'Docs');
    expect(docsContext).not.toContain('TAILMARKER');
    expect(docsContext).toContain('truncated');
  });

  it('still truncates PDFs beyond the larger cap', () => {
    reportActiveDocument('pdf', { name: 'huge.pdf', content: () => 'x'.repeat(20_000) });
    const context = buildAssistantContext('pdf', 'PDF');
    expect(context).toContain('truncated');
    expect(context.length).toBeLessThan(8_600);
  });
});

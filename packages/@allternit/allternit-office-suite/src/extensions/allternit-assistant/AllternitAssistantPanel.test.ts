import { beforeEach, describe, expect, it } from 'vitest';
import { buildAssistantContext } from './AllternitAssistantPanel';
import { registerActiveDocument, reportActiveDocument } from '../activeDocument';

describe('buildAssistantContext', () => {
  beforeEach(() => {
    registerActiveDocument('docs', null);
    reportActiveDocument('docs', null);
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
});

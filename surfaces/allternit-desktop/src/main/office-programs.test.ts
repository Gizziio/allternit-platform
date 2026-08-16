import { describe, expect, it } from 'vitest';
import {
  editorForFile,
  extractOfficeFileArg,
  isOfficeTarget,
  officePathFor,
  officeTitleFor,
} from './office-programs.js';

describe('office-programs', () => {
  it('routes each editor to its platform path', () => {
    expect(officePathFor('launcher')).toBe('/office');
    expect(officePathFor('docs')).toBe('/docs');
    expect(officePathFor('sheets')).toBe('/sheets');
    expect(officePathFor('slides')).toBe('/slides');
    expect(officePathFor('pdf')).toBe('/pdf');
    expect(officePathFor('markdown')).toBe('/markdown-preview');
    expect(officePathFor('docs', 'art-123')).toBe('/docs/art-123');
    expect(officePathFor('slides', 'a/b c')).toBe('/slides/a%2Fb%20c');
  });

  it('maps office file extensions to editors', () => {
    expect(editorForFile('/tmp/report.docx')).toBe('docs');
    expect(editorForFile('/tmp/legacy.DOC')).toBe('docs');
    expect(editorForFile('/tmp/book.XLSX')).toBe('sheets');
    expect(editorForFile('/tmp/legacy.xls')).toBe('sheets');
    expect(editorForFile('C:\\ decks\\pitch.pptx')).toBe('slides');
    expect(editorForFile('legacy.ppt')).toBe('slides');
    expect(editorForFile('scan.pdf')).toBe('pdf');
    expect(editorForFile('notes.txt')).toBe('markdown');
    expect(editorForFile('no-extension')).toBeNull();
  });

  it('routes formats with no editor to the markdown preview', () => {
    expect(editorForFile('/tmp/memo.rtf')).toBe('markdown');
    expect(editorForFile('data.csv')).toBe('markdown');
    expect(editorForFile('notes.odt')).toBe('markdown');
    expect(editorForFile('novel.epub')).toBe('markdown');
    // Editor-owned formats stay with their editors (not hijacked).
    expect(editorForFile('report.docx')).toBe('docs');
    expect(editorForFile('book.xlsx')).toBe('sheets');
    expect(editorForFile('deck.pptx')).toBe('slides');
    expect(editorForFile('scan.pdf')).toBe('pdf');
  });

  it('extracts an office file from argv, skipping flags', () => {
    expect(extractOfficeFileArg(['/Applications/Allternit.app', '--inspect', '/tmp/a.docx'])).toBe('/tmp/a.docx');
    expect(extractOfficeFileArg(['electron', '.'])).toBeNull();
    expect(extractOfficeFileArg(['--flag', 'readme.md'])).toBeNull();
  });

  it('validates office targets and titles', () => {
    expect(isOfficeTarget('docs')).toBe(true);
    expect(isOfficeTarget('launcher')).toBe(true);
    expect(isOfficeTarget('markdown')).toBe(true);
    expect(isOfficeTarget('excel')).toBe(false);
    expect(isOfficeTarget(42)).toBe(false);
    expect(officeTitleFor('pdf')).toBe('Allternit PDF');
    expect(officeTitleFor('markdown')).toBe('Markdown Preview');
    expect(officeTitleFor('launcher')).toBe('Allternit Office');
  });
});

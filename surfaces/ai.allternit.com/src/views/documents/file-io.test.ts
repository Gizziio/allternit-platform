import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as docx from 'docx';
import { documentToMarkdown, exportDocumentFile, importDocumentFile, markdownToDocument } from './file-io';
import type { AllternitDocument } from './office-io/types';

describe('file-io', () => {
  let storage: Map<string, string>;
  let downloaded: { name: string; blob: Blob; type: string }[];

  beforeEach(() => {
    storage = new Map();
    downloaded = [];
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    });
    vi.stubGlobal('crypto', { randomUUID: () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => `blob:${blob.size}`,
      revokeObjectURL: () => {},
    });
    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        const el: Record<string, unknown> = { tagName };
        return {
          set href(value: string) { el.href = value; },
          set download(value: string) { el.download = value; },
          click: () => {
            downloaded.push({ name: el.download as string, blob: { size: 0 } as Blob, type: 'application/octet-stream' });
          },
        };
      },
    });
  });

  describe('markdown round-trip', () => {
    it('converts a document to markdown', () => {
      const document: AllternitDocument = {
        title: 'Markdown Doc',
        blocks: [
          { type: 'heading', level: 1, content: [{ text: 'Title' }] },
          { type: 'paragraph', content: [{ text: 'Hello ', bold: true }, { text: 'world', italic: true }] },
          { type: 'list', style: 'bulleted', items: [{ type: 'paragraph', content: [{ text: 'First' }] }] },
          { type: 'divider' },
        ],
      };
      const md = documentToMarkdown(document);
      expect(md).toContain('# Title');
      expect(md).toContain('**Hello **_world_');
      expect(md).toContain('- First');
      expect(md).toContain('---');
    });

    it('round-trips markdown through document model', () => {
      const original = '# Heading\n\nSome **bold** text.\n\n- Item one\n- Item two\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |';
      const document = markdownToDocument('Round-trip', original);
      expect(document.blocks.some((b) => b.type === 'heading')).toBe(true);
      expect(document.blocks.some((b) => b.type === 'list')).toBe(true);
      expect(document.blocks.some((b) => b.type === 'table')).toBe(true);
      expect(document.blocks.some((b) => b.type === 'divider')).toBe(true);
    });

    it('imports nested lists', () => {
      const original = '- Parent 1\n  - Child 1\n  - Child 2\n- Parent 2';
      const document = markdownToDocument('Nested', original);
      const lists = document.blocks.filter((b) => b.type === 'list');
      expect(lists.length).toBe(1);
      const rootList = lists[0];
      expect(rootList.items.length).toBeGreaterThanOrEqual(2);
      const nested = rootList.items.find((item) => item.type === 'list');
      expect(nested).toBeDefined();
    });

    it('strips raw HTML into plain text', () => {
      const original = '<div>Hello</div> <p>World</p>';
      const document = markdownToDocument('HTML', original);
      const paragraph = document.blocks.find((b) => b.type === 'paragraph');
      expect(paragraph).toBeDefined();
      const text = paragraph?.content.map((r) => r.text).join('');
      expect(text).toContain('Hello');
      expect(text).toContain('World');
      expect(text).not.toContain('<');
    });

    it('preserves inline formatting in markdown output', () => {
      const document: AllternitDocument = {
        title: 'Inline',
        blocks: [
          {
            type: 'paragraph',
            content: [
              { text: 'bold', bold: true },
              { text: 'italic', italic: true },
              { text: 'code', code: true },
              { text: 'strike', strike: true },
            ],
          },
        ],
      };
      const md = documentToMarkdown(document);
      expect(md).toContain('**bold**');
      expect(md).toContain('_italic_');
      expect(md).toContain('`code`');
      expect(md).toContain('~~strike~~');
    });
  });

  describe('importDocumentFile', () => {
    it('imports a markdown file into the documents pack', async () => {
      const file = {
        name: 'notes.md',
        text: async () => '# Hello\n\nWorld',
        arrayBuffer: async () => new ArrayBuffer(0),
      };
      const imported = await importDocumentFile(file as unknown as File);
      expect(imported.pack).toBe('documents');
      expect(imported.title).toBe('notes');
    });

    it('imports a docx file into the documents pack', async () => {
      const document = new docx.Document({
        sections: [{ children: [new docx.Paragraph({ text: 'Hello' }), new docx.Paragraph({ text: 'World' })] }],
      });
      const buffer = await docx.Packer.toBuffer(document);
      const file = {
        name: 'report.docx',
        text: async () => '',
        arrayBuffer: async () => Uint8Array.from(buffer).buffer,
      };
      const imported = await importDocumentFile(file as unknown as File);
      expect(imported.pack).toBe('documents');
      expect(imported.title).toBe('report');
    });
  });

  describe('exportDocumentFile', () => {
    it('exports a document as markdown', async () => {
      const documentId = 'doc-export';
      storage.set('allternit.editor-pack.documents.doc-export.title', 'Export Test');
      storage.set('allternit.editor-pack.documents.doc-export', '# Hello\n\nWorld');

      await exportDocumentFile('documents', documentId, 'md');

      expect(downloaded.length).toBe(1);
      expect(downloaded[0].name).toBe('Export Test.md');
    });

    it('exports a sheet as csv', async () => {
      const documentId = 'sheet-export';
      storage.set('allternit.editor-pack.sheets.sheet-export.title', 'Sheet Test');
      storage.set('allternit.editor-pack.sheets.sheet-export', JSON.stringify({ '0:0': 'A', '0:1': 'B', '1:0': '1', '1:1': '2' }));

      await exportDocumentFile('sheets', documentId, 'csv');

      expect(downloaded.length).toBe(1);
      expect(downloaded[0].name).toBe('Sheet Test.csv');
    });
  });
});

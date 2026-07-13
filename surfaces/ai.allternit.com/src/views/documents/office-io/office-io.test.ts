import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import * as docx from 'docx';
import { exportDocxFile, exportPptxFile, exportXlsxFile, importOfficeFile } from './index';
import type { AllternitDeck, AllternitDocument, AllternitWorkbook, OfficeFileInput } from './types';

function makeFile(arrayBuffer: ArrayBuffer, name: string, type: string): OfficeFileInput {
  return {
    name,
    arrayBuffer: async () => arrayBuffer,
  };
}

async function blobToFile(blob: Blob, name: string): Promise<OfficeFileInput> {
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  return makeFile(arrayBuffer, name, blob.type);
}

describe('office-io', () => {
  it('round-trips a Word document', async () => {
    const doc = new docx.Document({
      sections: [
        {
          children: [
            new docx.Paragraph({ text: 'Hello World', heading: docx.HeadingLevel.HEADING_1 }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: 'Bold text', bold: true })] }),
          ],
        },
      ],
    });
    const nodeBuffer = await docx.Packer.toBuffer(doc);
    const buffer = Uint8Array.from(nodeBuffer).buffer;
    const file = makeFile(buffer, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    const imported = await importOfficeFile(file);
    expect(imported.model.title).toBe('test');
    expect(imported.model.blocks.length).toBeGreaterThan(0);

    const exported = await exportDocxFile(imported.model as AllternitDocument);
    expect(exported.size).toBeGreaterThan(0);
    expect(exported.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('round-trips an Excel workbook', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Value'],
      ['A', 1],
      ['B', 2],
    ]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    ws['!cols'] = [{ wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = makeFile(buffer, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const imported = await importOfficeFile(file);
    const model = imported.model as AllternitWorkbook;
    expect(model.sheets.length).toBe(1);
    expect(model.sheets[0].name).toBe('Sheet1');
    expect(Object.keys(model.sheets[0].cells).length).toBeGreaterThan(0);
    expect(model.sheets[0].merges.length).toBe(1);

    const exported = await exportXlsxFile(model);
    expect(exported.size).toBeGreaterThan(0);
    expect(exported.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const reimported = await importOfficeFile(await blobToFile(exported, 'test.xlsx'));
    const remodel = reimported.model as AllternitWorkbook;
    expect(remodel.sheets[0].cells['0:0'].value).toBe(model.sheets[0].cells['0:0'].value);
  });

  it('round-trips a PowerPoint deck', async () => {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    pptx.title = 'Test Deck';
    const slide = pptx.addSlide();
    slide.background = { fill: 'F8F7F4' };
    slide.addText('Hello Slide', { x: 0.5, y: 0.5, w: 8, h: 1, fontSize: 24, bold: true });
    const buffer = await pptx.write({ outputType: 'base64' });
    const binary = Uint8Array.from(atob(buffer as string), (c) => c.charCodeAt(0));
    const file = makeFile(binary.buffer, 'test.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

    const imported = await importOfficeFile(file);
    const model = imported.model as AllternitDeck;
    expect(model.title).toBe('test');
    expect(model.slides.length).toBe(1);
    expect(model.slides[0].blocks.length).toBeGreaterThan(0);

    const exported = await exportPptxFile(model);
    expect(exported.size).toBeGreaterThan(0);
    expect(exported.type).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
  });

  it('exports an Allternit document to docx', async () => {
    const document: AllternitDocument = {
      title: 'Allternit Doc',
      blocks: [
        { type: 'heading', level: 1, content: [{ text: 'Title' }] },
        { type: 'paragraph', content: [{ text: 'Body ', bold: true }, { text: 'text' }] },
      ],
    };
    const exported = await exportDocxFile(document);
    expect(exported.size).toBeGreaterThan(0);

    const file = await blobToFile(exported, 'allternit.docx');
    const imported = await importOfficeFile(file);
    expect(imported.model.blocks.length).toBeGreaterThan(0);
  });

  it('exports an Allternit workbook to xlsx', async () => {
    const workbook: AllternitWorkbook = {
      name: 'Allternit Sheet',
      sheets: [
        {
          id: 'Sheet1',
          name: 'Sheet1',
          cells: {
            '0:0': { value: 'Metric' },
            '0:1': { value: 'Q1' },
            '1:0': { value: 'Revenue' },
            '1:1': { value: 42000 },
          },
          merges: [],
          columnWidths: {},
          rowHeights: {},
        },
      ],
    };
    const exported = await exportXlsxFile(workbook);
    expect(exported.size).toBeGreaterThan(0);

    const file = await blobToFile(exported, 'allternit.xlsx');
    const imported = await importOfficeFile(file);
    const model = imported.model as AllternitWorkbook;
    expect(model.sheets[0].cells['1:1'].value).toBe(42000);
  });

  it('exports an Allternit deck to pptx', async () => {
    const deck: AllternitDeck = {
      title: 'Allternit Deck',
      slides: [
        {
          id: 'slide-1',
          layout: 'title',
          background: { type: 'color', value: '#F8F7F4' },
          blocks: [
            { type: 'text', text: 'Hello', x: 0.5, y: 0.5, w: 8, h: 1, style: { fontSize: 32, bold: true } },
          ],
        },
      ],
    };
    const exported = await exportPptxFile(deck);
    expect(exported.size).toBeGreaterThan(0);

    const file = await blobToFile(exported, 'allternit.pptx');
    const imported = await importOfficeFile(file);
    const model = imported.model as AllternitDeck;
    expect(model.slides.length).toBe(1);
  });
});

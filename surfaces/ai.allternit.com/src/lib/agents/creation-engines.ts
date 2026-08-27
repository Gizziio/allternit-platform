/**
 * Deterministic creation engines for Docs, Sheets, and Slides.
 *
 * These turn a constrained creation prompt into a real Office Open XML
 * artifact (DOCX/XLSX/PPTX) using the same Office I/O layer the native
 * Allternit editors already use for import/export.
 */

import { generateText } from 'ai';
import { getDefaultPluginModel } from '@/lib/ai/providers';
import type { PluginOutput } from '@/lib/plugins/types';
import {
  exportDocxFile,
  exportXlsxFile,
  type AllternitDocument,
  type AllternitWorkbook,
  type DocumentBlock,
  type InlineRun,
  type Sheet,
} from '@/views/documents/office-io';
import type { FormatSelection } from '@/views/create/presets';

interface GeneratedDoc {
  title: string;
  blocks: GeneratedDocBlock[];
}

type GeneratedDocBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string; align?: 'left' | 'center' | 'right' | 'justify' }
  | { type: 'list'; style: 'bulleted' | 'numbered'; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'divider' };

interface GeneratedCell {
  row: number;
  col: number;
  formula: string;
}

interface GeneratedSheet {
  name: string;
  cells: (string | number | boolean | null)[][];
  formulas?: GeneratedCell[];
}

interface GeneratedWorkbook {
  title: string;
  sheets: GeneratedSheet[];
}

function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model response.');
  return JSON.parse(match[0]) as T;
}

function toRuns(text: string): InlineRun[] {
  return [{ text }];
}

function generatedDocToModel(doc: GeneratedDoc): AllternitDocument {
  const blocks: DocumentBlock[] = doc.blocks
    .map((block): DocumentBlock | null => {
      switch (block.type) {
        case 'heading':
          return {
            type: 'heading',
            level: Math.min(Math.max(block.level, 1), 3) as 1 | 2 | 3,
            content: toRuns(block.text),
          };
        case 'paragraph':
          return {
            type: 'paragraph',
            content: toRuns(block.text),
            align: block.align,
          };
        case 'list':
          return {
            type: 'list',
            style: block.style,
            items: block.items.map((item) => ({
              type: 'paragraph',
              content: toRuns(item),
            })),
          };
        case 'table':
          return {
            type: 'table',
            rows: block.rows.map((row) => ({
              cells: row.map((cell) => ({
                blocks: [{ type: 'paragraph', content: toRuns(String(cell)) }],
              })),
            })),
          };
        case 'divider':
          return { type: 'divider' };
        default:
          return null;
      }
    })
    .filter((b): b is DocumentBlock => b !== null);

  return { title: doc.title, blocks };
}

function generatedWorkbookToModel(wb: GeneratedWorkbook): AllternitWorkbook {
  const sheets: Sheet[] = wb.sheets.map((sheet) => {
    const cells: Sheet['cells'] = {};
    for (let row = 0; row < sheet.cells.length; row += 1) {
      const rowData = sheet.cells[row];
      for (let col = 0; col < rowData.length; col += 1) {
        const value = rowData[col];
        if (value !== null && value !== undefined && value !== '') {
          cells[`${row}:${col}`] = { value };
        }
      }
    }
    for (const f of sheet.formulas ?? []) {
      const key = `${f.row}:${f.col}`;
      cells[key] = { ...cells[key], formula: f.formula };
    }
    return {
      id: sheet.name,
      name: sheet.name,
      cells,
      merges: [],
      columnWidths: {},
      rowHeights: {},
    };
  });

  return { name: wb.title, sheets };
}

function formatConstraintLines(formatSelection: FormatSelection): string {
  const lines: string[] = [];
  if (formatSelection.tabId) lines.push(`Active constraint tab: ${formatSelection.tabId}`);
  if (formatSelection.optionId) lines.push(`Selected option: ${formatSelection.optionId}`);
  if (formatSelection.custom) {
    lines.push(`Custom size: ${formatSelection.custom.width} × ${formatSelection.custom.height} ${formatSelection.custom.unit}`);
  }
  return lines.join('\n');
}

export async function generateDocxArtifact(
  prompt: string,
  formatSelection: FormatSelection,
  signal?: AbortSignal,
): Promise<PluginOutput> {
  const model = await getDefaultPluginModel();

  const { text } = await generateText({
    model,
    temperature: 0.3,
    abortSignal: signal,
    prompt: `You are a deterministic document generator. Create a polished, professional DOCX for the request below.

${formatConstraintLines(formatSelection)}

User request: ${prompt}

Return a JSON object with this exact shape (no markdown fences, no commentary):
{
  "title": "Document title",
  "blocks": [
    { "type": "heading", "level": 1, "text": "..." },
    { "type": "paragraph", "text": "...", "align": "left" },
    { "type": "list", "style": "bulleted|numbered", "items": ["..."] },
    { "type": "table", "rows": [["col1", "col2"], ["a", "b"]] },
    { "type": "divider" }
  ]
}`,
  });

  const doc = extractJson<GeneratedDoc>(text);
  if (!doc.title || !Array.isArray(doc.blocks)) {
    throw new Error('Document generation returned an invalid structure.');
  }

  const modelDoc = generatedDocToModel(doc);
  const blob = await exportDocxFile(modelDoc);
  const url = URL.createObjectURL(blob);

  return {
    success: true,
    content: `Created **${modelDoc.title}** as a Word document with ${modelDoc.blocks.length} blocks.`,
    artifacts: [
      {
        type: 'file',
        name: `${modelDoc.title.replace(/\s+/g, '-')}.docx`,
        url,
        metadata: { format: 'docx', document: modelDoc },
      },
    ],
  };
}

export async function generateXlsxArtifact(
  prompt: string,
  formatSelection: FormatSelection,
  signal?: AbortSignal,
): Promise<PluginOutput> {
  const model = await getDefaultPluginModel();

  const requestedSheets = Number(formatSelection.tabId === 'sheets' ? formatSelection.optionId : '1') || 1;

  const { text } = await generateText({
    model,
    temperature: 0.2,
    abortSignal: signal,
    prompt: `You are a deterministic spreadsheet generator. Create an editable XLSX workbook for the request below.

${formatConstraintLines(formatSelection)}
Target number of worksheets: ${requestedSheets}

User request: ${prompt}

Return a JSON object with this exact shape (no markdown fences, no commentary):
{
  "title": "Workbook title",
  "sheets": [
    {
      "name": "Sheet1",
      "cells": [
        ["Header A", "Header B"],
        [100, 200]
      ],
      "formulas": [
        { "row": 1, "col": 1, "formula": "=SUM(A2:A3)" }
      ]
    }
  ]
}

Use typed values (numbers for numeric cells, strings for labels). Include formulas for totals, forecasts, or calculations where appropriate.`,
  });

  const generated = extractJson<GeneratedWorkbook>(text);
  if (!generated.title || !Array.isArray(generated.sheets)) {
    throw new Error('Spreadsheet generation returned an invalid structure.');
  }

  // Honor the requested sheet count without trusting the model completely.
  while (generated.sheets.length < requestedSheets) {
    generated.sheets.push({ name: `Sheet${generated.sheets.length + 1}`, cells: [] });
  }
  if (generated.sheets.length > requestedSheets) {
    generated.sheets = generated.sheets.slice(0, requestedSheets);
  }

  const modelWb = generatedWorkbookToModel(generated);
  const blob = await exportXlsxFile(modelWb);
  const url = URL.createObjectURL(blob);

  return {
    success: true,
    content: `Created **${modelWb.name}** as an Excel workbook with ${modelWb.sheets.length} sheet(s).`,
    artifacts: [
      {
        type: 'file',
        name: `${modelWb.name.replace(/\s+/g, '-')}.xlsx`,
        url,
        metadata: { format: 'xlsx', workbook: modelWb },
      },
    ],
  };
}

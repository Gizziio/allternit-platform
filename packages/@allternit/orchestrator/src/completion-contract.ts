// packages/@allternit/orchestrator/src/completion-contract.ts
// The completion contract (ADR-0044): the executor's notes file starts with YAML
// frontmatter — status, files_changed, deviations, remaining — followed by prose.
// The file existing is the completion signal; this parses it into a CompletionReport.

import { readFile } from 'node:fs/promises';
import type { CompletionReport } from './orchestrator.interface.js';

const LIST_KEYS: Record<string, keyof Pick<CompletionReport, 'filesChanged' | 'deviations' | 'remaining'>> = {
  files_changed: 'filesChanged',
  deviations: 'deviations',
  remaining: 'remaining',
};

/**
 * Tolerant parser for the notes frontmatter. Handles inline arrays
 * (`key: [a, b]`) and block lists (`- item`). Unknown keys are ignored.
 * A malformed or missing frontmatter yields status 'blocked' with empty lists,
 * so a sloppy executor never silently passes review.
 */
export function parseCompletionNotes(raw: string, notesPath: string): CompletionReport {
  const report: CompletionReport = {
    status: 'blocked',
    filesChanged: [],
    deviations: [],
    remaining: [],
    notesPath,
    notesBody: raw,
  };

  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return report;
  report.notesBody = raw.slice(m[0].length);

  let currentList: string[] | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s*(.+?)\s*$/);
    if (item && currentList) {
      currentList.push(stripQuotes(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    currentList = null;
    if (key === 'status') {
      report.status = value.trim() === 'done' ? 'done' : 'blocked';
    } else if (LIST_KEYS[key]) {
      const target = report[LIST_KEYS[key]];
      const inline = value.trim();
      if (inline.startsWith('[')) {
        for (const part of inline.replace(/^\[|\]$/g, '').split(',')) {
          const v = stripQuotes(part.trim());
          if (v) target.push(v);
        }
      } else if (inline === '') {
        currentList = target;
      } else {
        target.push(stripQuotes(inline));
      }
    }
  }
  return report;
}

export async function readCompletionNotes(notesPath: string): Promise<CompletionReport> {
  const raw = await readFile(notesPath, 'utf8');
  return parseCompletionNotes(raw, notesPath);
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '');
}

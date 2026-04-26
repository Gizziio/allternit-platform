/**
 * Transcript Search Worker — full-text search across JSONL session transcripts.
 * Scans files line-by-line and extracts snippets with context window.
 */

import { workerData, parentPort } from 'node:worker_threads';
import { MessagePort } from 'node:worker_threads';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SNIPPET_RADIUS = 80;

const port: MessagePort = workerData.port;
const transcriptDir: string = workerData.transcriptDir ?? '';

interface SearchResult {
  sessionId: string;
  filePath: string;
  lineNumber: number;
  snippet: string;
  score: number;
}

function extractSnippet(text: string, matchIndex: number, query: string): string {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchIndex + query.length + SNIPPET_RADIUS);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function scoreMatch(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  let idx = 0;
  while ((idx = lower.indexOf(q, idx)) !== -1) {
    score++;
    idx += q.length;
  }
  return score;
}

function searchFile(filePath: string, sessionId: string, query: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const lower = query.toLowerCase();

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return results;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length && results.length < limit; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Try to extract text content from JSONL message objects
    let text = line;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (typeof parsed['content'] === 'string') text = parsed['content'];
      else if (typeof parsed['text'] === 'string') text = parsed['text'];
      else if (typeof parsed['message'] === 'string') text = parsed['message'];
    } catch { /* not JSON, search raw line */ }

    const matchIdx = text.toLowerCase().indexOf(lower);
    if (matchIdx !== -1) {
      results.push({
        sessionId,
        filePath,
        lineNumber: i + 1,
        snippet: extractSnippet(text, matchIdx, query),
        score: scoreMatch(text, query),
      });
    }
  }

  return results;
}

port.on('message', (msg: { id?: string; type: string; payload?: unknown }) => {
  const { id, type, payload } = msg;
  try {
    let result: unknown;

    if (type === 'search') {
      const { query, sessionId, limit = 50 } = payload as {
        query: string;
        sessionId?: string;
        limit?: number;
      };

      if (!transcriptDir || !fs.existsSync(transcriptDir)) {
        result = [];
      } else {
        const allResults: SearchResult[] = [];
        const files = fs.readdirSync(transcriptDir).filter(f => f.endsWith('.jsonl'));

        for (const file of files) {
          const sid = path.basename(file, '.jsonl');
          if (sessionId && sid !== sessionId) continue;
          const fp = path.join(transcriptDir, file);
          const fileResults = searchFile(fp, sid, query, limit);
          allResults.push(...fileResults);
          if (allResults.length >= limit * 2) break;
        }

        // Sort by score descending, take top results
        allResults.sort((a, b) => b.score - a.score);
        result = allResults.slice(0, limit);
      }
    } else if (type === 'indexSession') {
      // Future: pre-index for faster search
      result = { indexed: false, reason: 'in-memory search used' };
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }

    if (id) port.postMessage({ id, payload: result });
  } catch (err) {
    if (id) port.postMessage({ id, error: (err as Error).message });
  }
});

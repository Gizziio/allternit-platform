/**
 * Extraction accuracy evaluator for the memory agent.
 *
 * Runs a small held-out eval set through LocalModelManager.enrichContent() and
 * scores extracted entities, topics, and importance against expected values.
 *
 * Usage (from services/memory/agent):
 *   node --loader tsx scripts/eval-extraction.ts [path/to/eval-extraction.json]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LocalModelManager } from '../src/models/local-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EvalCase {
  id: string;
  content: string;
  expected: {
    entities: string[];
    topics: string[];
    importance: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface EvalResult {
  id: string;
  backend: string;
  entityF1: number;
  topicF1: number;
  importanceCorrect: number;
  score: number;
}

function normalizeSet(items: string[]): Set<string> {
  return new Set(
    items
      .map((s) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter((s) => s.length > 0)
  );
}

function matches(a: string, e: string): boolean {
  return a === e || a.includes(e) || e.includes(a);
}

function f1Score(expected: string[], actual: string[]): number {
  const exp = Array.from(normalizeSet(expected));
  const act = Array.from(normalizeSet(actual));
  if (exp.length === 0 && act.length === 0) return 1.0;
  if (exp.length === 0 || act.length === 0) return 0.0;

  // Greedy one-to-one matching so overlap is bounded by min(exp, act).
  const usedExpected = new Set<number>();
  let overlap = 0;
  for (const a of act) {
    for (let i = 0; i < exp.length; i++) {
      if (!usedExpected.has(i) && matches(a, exp[i])) {
        usedExpected.add(i);
        overlap++;
        break;
      }
    }
  }

  const precision = act.length > 0 ? overlap / act.length : 0;
  const recall = exp.length > 0 ? overlap / exp.length : 0;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

async function loadEvalSet(evalPath: string): Promise<EvalCase[]> {
  const raw = await fs.readFile(evalPath, 'utf-8');
  return JSON.parse(raw) as EvalCase[];
}

async function main(): Promise<void> {
  const evalPath = process.argv[2] || path.join(__dirname, '..', 'data', 'eval-extraction.json');
  const cases = await loadEvalSet(evalPath);

  const manager = new LocalModelManager();
  const results: EvalResult[] = [];

  for (const c of cases) {
    const enriched = await manager.enrichContent(c.content, 150);
    const entityF1 = f1Score(c.expected.entities, enriched.entities);
    const topicF1 = f1Score(c.expected.topics, enriched.topics);
    const importanceCorrect = enriched.importance === c.expected.importance ? 1 : 0;
    const score = (entityF1 + topicF1 + importanceCorrect) / 3;

    results.push({
      id: c.id,
      backend: enriched.backend,
      entityF1,
      topicF1,
      importanceCorrect,
      score,
    });

    console.log(
      `${c.id}: backend=${enriched.backend} entityF1=${entityF1.toFixed(2)} ` +
        `topicF1=${topicF1.toFixed(2)} importance=${enriched.importance} ` +
        `(expected ${c.expected.importance}) score=${score.toFixed(2)}`
    );
  }

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const avgEntityF1 = results.reduce((sum, r) => sum + r.entityF1, 0) / results.length;
  const avgTopicF1 = results.reduce((sum, r) => sum + r.topicF1, 0) / results.length;
  const importanceAccuracy = results.reduce((sum, r) => sum + r.importanceCorrect, 0) / results.length;

  console.log('');
  console.log(`Evaluated ${results.length} cases`);
  console.log(`Average entity F1: ${avgEntityF1.toFixed(2)}`);
  console.log(`Average topic F1: ${avgTopicF1.toFixed(2)}`);
  console.log(`Importance accuracy: ${importanceAccuracy.toFixed(2)}`);
  console.log(`Overall score: ${avgScore.toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

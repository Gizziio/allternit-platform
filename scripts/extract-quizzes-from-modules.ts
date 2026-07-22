#!/usr/bin/env npx tsx
/**
 * Extract quizzes from generated A://Labs HTML modules and emit Canvas-ready JSON.
 *
 * Uses jsdom to parse the many different quiz markup patterns used across
 * generated modules, then emits one JSON file per module to
 * `alabs-generated-courses/quizzes/`.
 *
 * Usage:
 *   npx tsx scripts/extract-quizzes-from-modules.ts
 *   npx tsx scripts/extract-quizzes-from-modules.ts --input alabs-generated-courses --output alabs-generated-courses/quizzes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { JSDOM } from 'jsdom';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizFile {
  title: string;
  questions: QuizQuestion[];
}

const DEFAULT_INPUT_DIR = 'alabs-generated-courses';
const DEFAULT_OUTPUT_DIR = 'alabs-generated-courses/quizzes';

function cleanText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[A-D]\.\s*/, '')
    .trim();
}

function parseJsObjectBlock(body: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  const pairs = body.match(/(\d+)\s*:\s*([^,]+)/g) ?? [];
  for (const pair of pairs) {
    const m = pair.match(/^(\d+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim();
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const quote = raw[0];
      const end = raw.slice(1).indexOf(quote);
      result[key] = raw.slice(1, end + 1);
    } else {
      const num = Number(raw);
      result[key] = Number.isNaN(num) ? raw : num;
    }
  }
  return result;
}

function parseBlockStringObject(text: string, name: string): Record<string, string> {
  const out: Record<string, string> = {};
  const regex = new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`, 'm');
  const match = text.match(regex);
  if (!match) return out;

  for (const m of match[1].matchAll(/(\w+)\s*:\s*(["'])(.*?)\2/g)) {
    out[m[1]] = cleanText(m[3]);
  }
  return out;
}

function parseQuizAnswersNumeric(text: string): Record<string, number> {
  const match = text.match(/const\s+quizAnswers\s*=\s*\{([^}]+)\}/);
  if (!match) return {};
  const entries = parseJsObjectBlock(match[1]);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(entries)) {
    out[k] = typeof v === 'number' ? v : Number(v);
  }
  return out;
}

function parseQuizFeedback(text: string): Record<string, { correct: string; wrong: string }> {
  const out: Record<string, { correct: string; wrong: string }> = {};
  const match = text.match(/const\s+quizFeedback\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if (!match) return out;

  const entries = match[1].match(/(\d+|\w+)\s*:\s*\{[\s\S]*?correct:\s*(['"`])([\s\S]*?)\2[\s\S]*?wrong:\s*(['"`])([\s\S]*?)\4/sg) ?? [];
  for (const entry of entries) {
    const idMatch = entry.match(/^(\d+|\w+)\s*:/);
    const correctMatch = entry.match(/correct:\s*(['"`])([\s\S]*?)\1/s);
    const wrongMatch = entry.match(/wrong:\s*(['"`])([\s\S]*?)\1/s);
    if (idMatch && correctMatch && wrongMatch) {
      out[idMatch[1]] = {
        correct: cleanText(correctMatch[2]),
        wrong: cleanText(wrongMatch[2]),
      };
    }
  }
  return out;
}

function parseGetCorrectText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const matches = text.matchAll(/if\s*\(\s*qid\s*===?\s*['"`]([^'"`]+)['"`]\s*\)\s*return\s*['"`]([^'"`]+)['"`]/g);
  for (const m of matches) {
    out[m[1]] = cleanText(m[2]);
  }
  return out;
}

function parseModuleQuizzes(html: string): QuizQuestion[] {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const document = dom.window.document;

  const quizAnswersNumeric = parseQuizAnswersNumeric(html);
  const quizAnswersString = parseBlockStringObject(html, 'quizAnswers');
  const quizFeedback = parseQuizFeedback(html);
  const getCorrectText = parseGetCorrectText(html);

  // Find any element that starts a quiz block. Generated modules use a variety
  // of class names and wrappers, so accept all of them.
  const selectors = '.quiz-card, .quiz-container, .quiz';
  const blocks = Array.from(document.querySelectorAll(selectors)).filter(el => {
    // `.quiz` can match nested option wrappers in some templates; keep only
    // blocks that contain option elements.
    return el.querySelector('.quiz-option') !== null;
  });

  const questions: QuizQuestion[] = [];

  for (const block of blocks) {
    let qid = block.getAttribute('data-quiz') ?? block.id ?? '';

    // Some templates put the quiz id on the feedback element or the parent
    // section instead of the quiz block itself.
    if (!qid) {
      const feedback = block.querySelector('.quiz-feedback');
      const feedbackId = feedback?.id ?? '';
      qid = feedbackId.replace(/-feedback$/, '');
    }
    if (!qid) {
      qid = block.closest('section')?.id ?? '';
    }

    let questionEl = block.querySelector('.quiz-question');
    if (!questionEl) {
      const header = block.querySelector('.quiz-header');
      questionEl = header?.querySelector('h3, h4') ?? block.querySelector('h3, h4');
    }
    const question = cleanText(questionEl?.textContent);

    const optionEls = Array.from(block.querySelectorAll('.quiz-option'));
    const options: string[] = [];
    let correctIndex = -1;

    optionEls.forEach((opt, idx) => {
      const correctAttr = opt.getAttribute('data-correct');
      if (correctAttr === 'true') {
        correctIndex = idx;
      }

      // Some templates encode correctness in an onclick handler instead of a
      // data attribute.
      const onclick = opt.getAttribute('onclick') ?? '';
      const checkMatch = onclick.match(/checkAnswer\(\s*this\s*,\s*(true|false)\s*,\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (checkMatch && checkMatch[1] === 'true') {
        correctIndex = idx;
      }

      options.push(cleanText(opt.textContent));
    });

    if (options.length === 0) continue;

    // If correctness still isn't known, fall back to numeric quizAnswers maps
    // keyed by either the block id or the block's 1-based index.
    if (correctIndex === -1) {
      const numericKey = String(questions.length + 1);
      const answer =
        quizAnswersNumeric[qid] ??
        quizAnswersNumeric[qid.replace(/\D/g, '')] ??
        quizAnswersNumeric[numericKey];
      if (answer !== undefined) {
        correctIndex = answer;
      }
    }

    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    // Explanation priority:
    //   1. Inline correct feedback element
    //   2. String-valued quizAnswers map (e.g. qid -> explanation)
    //   3. quizFeedback object
    //   4. getCorrectText(qid) map
    //   5. Text of the correct option
    let explanation = '';
    const inlineCorrect = block.querySelector('[data-feedback="correct"]');
    if (inlineCorrect) {
      explanation = cleanText(inlineCorrect.textContent);
    } else if (quizAnswersString[qid]) {
      explanation = quizAnswersString[qid];
    } else if (quizFeedback[qid]?.correct) {
      explanation = quizFeedback[qid].correct;
    } else if (getCorrectText[qid]) {
      explanation = getCorrectText[qid];
    } else {
      explanation = options[correctIndex];
    }

    questions.push({ question, options, correctIndex, explanation });
  }

  return questions;
}

function outputNameFromFilename(filename: string): string {
  const base = path.basename(filename, '.html');
  const parts = base.split('-');
  const modulePart = parts.pop() ?? 'module';
  const topic = parts.pop()?.toLowerCase() ?? 'unknown';
  return `${topic}-${modulePart.replace(/module/i, 'm').toLowerCase()}.json`;
}

async function main() {
  const args = process.argv.slice(2);
  const inputDir = args[args.indexOf('--input') + 1] ?? DEFAULT_INPUT_DIR;
  const outputDir = args[args.indexOf('--output') + 1] ?? DEFAULT_OUTPUT_DIR;

  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const htmlFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.html'))
    .map(e => path.join(inputDir, e.name))
    .sort();

  let generated = 0;
  let skipped = 0;

  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, 'utf-8');
    const questions = parseModuleQuizzes(html);

    if (questions.length === 0) {
      skipped++;
      continue;
    }

    const moduleLabel = path.basename(filePath, '.html');
    const title = `Module Quiz: ${moduleLabel}`;
    const quiz: QuizFile = { title, questions };
    const outName = outputNameFromFilename(filePath);
    const outPath = path.join(outputDir, outName);

    await fs.writeFile(outPath, JSON.stringify(quiz, null, 2), 'utf-8');
    console.log(`✅ ${outName}: ${questions.length} question(s)`);
    generated++;
  }

  console.log(`\nGenerated ${generated} quiz file(s), skipped ${skipped} file(s) with no quiz markup.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

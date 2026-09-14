#!/usr/bin/env npx tsx
/**
 * Build a self-contained Code-Hike-style code walkthrough for an A://Labs module.
 *
 * Reads a JSON source that points to a code file and a list of steps. Each step
 * highlights specific lines and shows an explanation. The output is static HTML
 * with scroll-reveal line highlighting and step navigation.
 *
 * Source format:
 * {
 *   "file": "packages/@allternit/provider-adapters/src/ai-sdk.ts",
 *   "language": "typescript",
 *   "steps": [
 *     { "title": "Import the adapter", "lines": [1, 2, 3], "note": "..." },
 *     { "title": "Consume the stream", "lines": [10, 11, 12], "note": "..." }
 *   ]
 * }
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface WalkthroughStep {
  title: string;
  lines: number[];
  note: string;
}

export interface WalkthroughAsset {
  id: string;
  src: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenizeLine(line: string): string {
  let html = escapeHtml(line);
  // Very lightweight syntax highlighting for common TypeScript tokens
  html = html.replace(/\b(const|let|var|function|class|interface|type|import|from|export|async|await|return|if|else|for|while|switch|case|break|new|this|throw|try|catch)\b/g, '<span class="token-keyword">$1</span>');
  html = html.replace(/\b(true|false|null|undefined)\b/g, '<span class="token-keyword">$1</span>');
  html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="token-string">$1</span>');
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  html = html.replace(/(\/\/.*$)/gm, '<span class="token-comment">$1</span>');
  return html;
}

export async function buildWalkthrough(asset: WalkthroughAsset, worktreeRoot: string): Promise<string> {
  const source = await fs.readFile(asset.src, 'utf-8');
  const config = JSON.parse(source);

  const codePath = path.isAbsolute(config.file)
    ? config.file
    : path.join(worktreeRoot, config.file);

  const code = await fs.readFile(codePath, 'utf-8');
  const lines = code.split(/\r?\n/);

  const maxLineNo = lines.length;
  const lineNoWidth = String(maxLineNo).length;

  const contextLines = config.contextLines ?? 2;

  const stepsHtml = config.steps.map((step: WalkthroughStep, index: number) => {
    const stepId = `${asset.id}-step-${index}`;
    const highlightSet = new Set(step.lines);

    // Build a window: highlighted lines plus contextLines on each side
    const included = new Set<number>();
    for (const lineNo of step.lines) {
      for (let i = Math.max(1, lineNo - contextLines); i <= Math.min(lines.length, lineNo + contextLines); i++) {
        included.add(i);
      }
    }

    const sortedLines = Array.from(included).sort((a, b) => a - b);
    const codeRows = sortedLines.map((lineNo, idx, arr) => {
      const rawLine = lines[lineNo - 1];
      const isHighlighted = highlightSet.has(lineNo);
      const paddedNo = String(lineNo).padStart(lineNoWidth, ' ');
      const lineHtml = tokenizeLine(rawLine);
      const prev = arr[idx - 1];
      const ellipsis = prev && lineNo > prev + 1 ? '<div class="walkthrough-line ellipsis"><span class="line-no"></span><span class="line-code">⋮</span></div>' : '';
      return `${ellipsis}<div class="walkthrough-line ${isHighlighted ? 'highlight' : 'dim'}" data-line="${lineNo}">
        <span class="line-no">${paddedNo}</span>
        <span class="line-code">${lineHtml || '&nbsp;'}</span>
      </div>`;
    }).join('\n');

    return `
<div class="walkthrough-step alabs-media" id="${stepId}" data-walkthrough="${asset.id}" data-step="${index}">
  <div class="walkthrough-header">
    <span class="walkthrough-step-num">Step ${index + 1}</span>
    <h4>${escapeHtml(step.title)}</h4>
  </div>
  <div class="walkthrough-note">
    <p>${escapeHtml(step.note)}</p>
  </div>
  <div class="code-block walkthrough-code">
    <div class="code-header">
      <span class="code-lang">${config.language || 'typescript'}</span>
      <span class="code-path">${config.file}</span>
    </div>
    <pre>${codeRows}</pre>
  </div>
</div>
    `.trim();
  }).join('\n');

  const controls = `
<div class="walkthrough-controls" data-walkthrough-controls="${asset.id}">
  <button class="walkthrough-prev" onclick="Walkthrough.step('${asset.id}', -1)">← Previous</button>
  <span class="walkthrough-counter"><span class="current">1</span> / ${config.steps.length}</span>
  <button class="walkthrough-next" onclick="Walkthrough.step('${asset.id}', 1)">Next →</button>
</div>
  `.trim();

  return `
<div class="walkthrough-container" data-walkthrough-container="${asset.id}">
  ${controls}
  <div class="walkthrough-steps">
    ${stepsHtml}
  </div>
</div>
  `.trim();
}

// CLI usage for testing
async function main() {
  const srcIdx = process.argv.indexOf('--src');
  const idIdx = process.argv.indexOf('--id');
  const rootIdx = process.argv.indexOf('--root');
  if (srcIdx === -1 || idIdx === -1) {
    console.error('Usage: build-walkthrough.ts --src <file.json> --id <asset-id> --root <worktree-root>');
    process.exit(1);
  }
  const worktreeRoot = rootIdx === -1 ? process.cwd() : process.argv[rootIdx + 1];
  const html = await buildWalkthrough({ src: process.argv[srcIdx + 1], id: process.argv[idIdx + 1] }, worktreeRoot);
  console.log(html);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}

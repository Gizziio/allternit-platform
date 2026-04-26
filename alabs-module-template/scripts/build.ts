#!/usr/bin/env npx tsx
/**
 * A://Labs Module Template Builder
 *
 * Builds self-contained HTML modules from a content JSON file + shared shell.
 *
 * Usage:
 *   npx tsx alabs-module-template/scripts/build.ts \
 *     --content alabs-generated-courses/content/workflow-m2.json \
 *     --output alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ModuleContent {
  title: string;
  tier: 'CORE' | 'OPS' | 'AGENTS' | 'ADV';
  sourcePackage: string;
  accentColor: string;
  navLinks: Array<{ label: string; section: string }>;
  moduleCss: string;
  moduleContent: string;
  moduleJs: string;
  quizAnswers: Record<string, number>;
  quizFeedback: Record<string, { correct: string; wrong: string }>;
}

const TIER_COLORS: Record<string, { accent: string; dim: string; glow: string; light: string; badgeBorder: string }> = {
  CORE:    { accent: '#3b82f6', dim: 'rgba(59,130,246,0.15)', glow: 'rgba(59,130,246,0.4)', light: '#60a5fa', badgeBorder: 'rgba(59,130,246,0.25)' },
  OPS:     { accent: '#8b5cf6', dim: 'rgba(139,92,246,0.15)', glow: 'rgba(139,92,246,0.4)', light: '#a78bfa', badgeBorder: 'rgba(139,92,246,0.25)' },
  AGENTS:  { accent: '#ec4899', dim: 'rgba(236,72,153,0.15)', glow: 'rgba(236,72,153,0.4)', light: '#f472b6', badgeBorder: 'rgba(236,72,153,0.25)' },
  ADV:     { accent: '#f59e0b', dim: 'rgba(245,158,11,0.15)', glow: 'rgba(245,158,11,0.4)', light: '#fbbf24', badgeBorder: 'rgba(245,158,11,0.25)' },
};

async function loadShell(): Promise<string> {
  const shellPath = path.join(__dirname, '../shell/shell.html');
  return fs.readFile(shellPath, 'utf-8');
}

async function loadContent(contentPath: string): Promise<ModuleContent> {
  const raw = await fs.readFile(contentPath, 'utf-8');
  return JSON.parse(raw);
}

function generateNavLinks(links: Array<{ label: string; section: string }>): string {
  return links.map(l =>
    `<li><a href="#${l.section}" data-section="${l.section}">${l.label}</a></li>`
  ).join('\n        ');
}

function injectQuizJs(content: ModuleContent): string {
  const answersJson = JSON.stringify(content.quizAnswers);
  const feedbackJson = JSON.stringify(content.quizFeedback);
  return `
    // Initialize quiz engine
    window.QuizEngine.init(${answersJson}, ${feedbackJson});

    ${content.moduleJs}
  `.trim();
}

async function buildModule(contentPath: string, outputPath: string) {
  console.log(`🔧 Building module from ${contentPath}...`);

  const [shell, content] = await Promise.all([
    loadShell(),
    loadContent(contentPath),
  ]);

  const colors = TIER_COLORS[content.tier] || TIER_COLORS.ADV;

  let html = shell;

  // Replace all template variables
  const replacements: Record<string, string> = {
    '{{MODULE_TITLE}}': content.title,
    '{{TIER}}': content.tier,
    '{{SOURCE_PACKAGE}}': content.sourcePackage,
    '{{ACCENT_COLOR}}': colors.accent,
    '{{ACCENT_DIM}}': colors.dim,
    '{{ACCENT_GLOW}}': colors.glow,
    '{{ACCENT_LIGHT}}': colors.light,
    '{{ACCENT_BADGE_BORDER}}': colors.badgeBorder,
    '{{NAV_LINKS}}': generateNavLinks(content.navLinks),
    '{{MODULE_CSS}}': content.moduleCss,
    '{{MODULE_CONTENT}}': content.moduleContent,
    '{{MODULE_JS}}': injectQuizJs(content),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value);
  }

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, 'utf-8');

  const sizeKb = (html.length / 1024).toFixed(1);
  console.log(`✅ Built ${outputPath} (${sizeKb} KB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const contentIdx = args.indexOf('--content');
  const outputIdx = args.indexOf('--output');

  if (contentIdx === -1 || outputIdx === -1) {
    console.error('Usage: npx tsx build.ts --content <json> --output <html>');
    process.exit(1);
  }

  const contentPath = args[contentIdx + 1];
  const outputPath = args[outputIdx + 1];

  await buildModule(contentPath, outputPath);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

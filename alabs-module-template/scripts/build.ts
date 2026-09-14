#!/usr/bin/env npx tsx
/**
 * A://Labs Module Template Builder
 *
 * Builds self-contained HTML modules from a content JSON file + shared shell.
 * Supports media assets (Mermaid, Asciinema, Code Hike, Sandpack, Manim, Remotion)
 * declared in the content JSON.
 *
 * Usage:
 *   npx tsx alabs-module-template/scripts/build.ts \
 *     --content alabs-generated-courses/content/workflow-m2.json \
 *     --output alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { buildMermaid } from './media/build-mermaid';
import { buildAsciinema } from './media/build-asciinema';
import { buildWalkthrough } from './media/build-walkthrough';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface MediaAsset {
  id: string;
  type: 'mermaid' | 'asciinema' | 'walkthrough' | 'sandpack' | 'manim' | 'remotion';
  src: string;
}

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
  mediaAssets?: MediaAsset[];
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

async function processMediaAssets(content: ModuleContent, worktreeRoot: string): Promise<{
  mediaById: Record<string, string>;
  mediaTypes: Set<string>;
}> {
  const mediaById: Record<string, string> = {};
  const mediaTypes = new Set<string>();

  if (!content.mediaAssets || content.mediaAssets.length === 0) {
    return { mediaById, mediaTypes };
  }

  for (const asset of content.mediaAssets) {
    const absoluteSrc = path.isAbsolute(asset.src)
      ? asset.src
      : path.join(worktreeRoot, asset.src);

    let markup = '';
    switch (asset.type) {
      case 'mermaid':
        markup = await buildMermaid({ id: asset.id, src: absoluteSrc });
        break;
      case 'asciinema':
        markup = await buildAsciinema({ id: asset.id, src: absoluteSrc });
        break;
      case 'walkthrough':
        markup = await buildWalkthrough({ id: asset.id, src: absoluteSrc }, worktreeRoot);
        break;
      default:
        throw new Error(`Unsupported media type: ${asset.type} (asset ${asset.id})`);
    }

    mediaById[asset.id] = markup;
    mediaTypes.add(asset.type);
  }

  return { mediaById, mediaTypes };
}

function injectMediaRunners(shell: string, mediaTypes: Set<string>): string {
  const headInsertions: string[] = [];

  if (mediaTypes.has('mermaid')) {
    headInsertions.push(`
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'dark', themeVariables: { primaryColor: '{{ACCENT_COLOR}}', primaryTextColor: '#e5e5e5', primaryBorderColor: '{{ACCENT_COLOR}}', lineColor: '#a1a1aa', secondaryColor: '#151517', tertiaryColor: '#0b0b0c', fontFamily: 'Inter, system-ui, sans-serif' }});
  </script>`);
  }

  if (mediaTypes.has('asciinema')) {
    headInsertions.push(`
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/asciinema-player@3/dist/bundle/asciinema-player.css" />
  <script src="https://cdn.jsdelivr.net/npm/asciinema-player@3/dist/bundle/asciinema-player.min.js"></script>`);
  }

  if (headInsertions.length === 0) {
    return shell;
  }

  return shell.replace('</head>', headInsertions.join('\n') + '\n</head>');
}

function replaceMediaPlaceholders(moduleContent: string, mediaById: Record<string, string>): string {
  return moduleContent.replace(/\{\{MEDIA:([^}]+)\}\}/g, (match, id) => {
    if (mediaById[id]) {
      return mediaById[id];
    }
    console.warn(`⚠️ Media placeholder not found: ${id}`);
    return `<!-- missing media: ${id} -->`;
  });
}

async function buildModule(contentPath: string, outputPath: string) {
  console.log(`🔧 Building module from ${contentPath}...`);

  const worktreeRoot = path.resolve(path.join(__dirname, '../..'));

  const [shell, content] = await Promise.all([
    loadShell(),
    loadContent(contentPath),
  ]);

  const colors = TIER_COLORS[content.tier] || TIER_COLORS.ADV;

  // Process media assets
  const { mediaById, mediaTypes } = await processMediaAssets(content, worktreeRoot);
  const contentWithMedia = replaceMediaPlaceholders(content.moduleContent, mediaById);

  let html = shell;

  // Inject media runtime loaders before other replacements
  html = injectMediaRunners(html, mediaTypes);

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
    '{{MODULE_CONTENT}}': contentWithMedia,
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

#!/usr/bin/env npx tsx
/**
 * Convert existing HTML modules to the new content JSON format.
 *
 * Usage:
 *   npx tsx alabs-module-template/scripts/convert-existing.ts \
 *     --input alabs-generated-courses/ALABS-ADV-WORKFLOW-module1.html \
 *     --output alabs-generated-courses/content/workflow-m1.json
 */

import * as fs from 'fs/promises';

const TIER_COLORS: Record<string, string> = {
  '#3b82f6': 'CORE',
  '#8b5cf6': 'OPS',
  '#ec4899': 'AGENTS',
  '#f59e0b': 'ADV',
};

interface ParsedModule {
  title: string;
  tier: string;
  sourcePackage: string;
  navLinks: Array<{ label: string; section: string }>;
  moduleCss: string;
  moduleContent: string;
  moduleJs: string;
  quizAnswers: Record<string, number>;
  quizFeedback: Record<string, { correct: string; wrong: string }>;
}

function extractBetween(html: string, startMarker: string, endMarker: string): string {
  const start = html.indexOf(startMarker);
  if (start === -1) return '';
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return '';
  return html.slice(start + startMarker.length, end).trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title>(.*?) — A:\/\/Labs<\/title>/);
  return match ? match[1] : 'Untitled Module';
}

function extractTier(html: string): string {
  // Look for accent color in CSS
  const match = html.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
  if (match) {
    return TIER_COLORS[match[1].toLowerCase()] || 'ADV';
  }
  // Look for nav-tier text
  const tierMatch = html.match(/class="nav-tier">(\w+)</);
  return tierMatch ? tierMatch[1] : 'ADV';
}

function extractSourcePackage(html: string): string {
  const match = html.match(/Generated from <code>(.*?)<\/code>/);
  return match ? match[1] : '';
}

function extractNavLinks(html: string): Array<{ label: string; section: string }> {
  const navSection = extractBetween(html, '<ul class="nav-links" id="navLinks">', '</ul>');
  const links: Array<{ label: string; section: string }> = [];
  const regex = /<a href="#([^"]+)" data-section="([^"]+)">([^<]+)<\/a>/g;
  let match;
  while ((match = regex.exec(navSection)) !== null) {
    links.push({ section: match[2], label: match[3] });
  }
  return links;
}

function extractModuleCss(html: string): string {
  const styleContent = extractBetween(html, '<style>', '</style>');
  // Remove the shared CSS (everything up to the module-specific injection point)
  const moduleStart = styleContent.indexOf('/* Module-specific styles injection point */');
  if (moduleStart === -1) {
    // For older modules without the marker, we need to extract only module-specific CSS
    // This is a best-effort approach - we look for canvas/simulation related CSS
    const lines = styleContent.split('\n');
    const moduleLines: string[] = [];
    let inModuleSection = false;
    for (const line of lines) {
      if (line.includes('canvas') || line.includes('Canvas') || line.includes('sim') || line.includes('animation') || line.includes('draw') || line.includes('dag') || line.includes('sched')) {
        inModuleSection = true;
      }
      if (inModuleSection) {
        moduleLines.push(line);
      }
    }
    return moduleLines.join('\n');
  }
  return styleContent.slice(moduleStart + '/* Module-specific styles injection point */'.length).trim();
}

function extractModuleContent(html: string): string {
  // Extract everything between </nav> and <footer>
  const navEnd = html.indexOf('</nav>');
  const footerStart = html.indexOf('<footer>');
  if (navEnd === -1 || footerStart === -1) return '';
  return html.slice(navEnd + '</nav>'.length, footerStart).trim();
}

function extractModuleJs(html: string): string {
  const scriptContent = extractBetween(html, '<script>', '</script>');
  // Remove shared JS (everything up to the module-specific injection point)
  const moduleStart = scriptContent.indexOf('// ========================');
  const moduleEndMarker = '// Module-specific JS injection point';
  const injectionStart = scriptContent.indexOf(moduleEndMarker);
  if (injectionStart !== -1) {
    return scriptContent.slice(injectionStart + moduleEndMarker.length).trim();
  }
  // For older modules, try to extract quiz answers and custom animations
  const lines = scriptContent.split('\n');
  const moduleLines: string[] = [];
  let skipShared = true;
  for (const line of lines) {
    if (line.includes('quizAnswers') || line.includes('quizFeedback') || line.includes('const dag') || line.includes('const sched') || line.includes('Canvas') || line.includes('canvas')) {
      skipShared = false;
    }
    if (!skipShared) {
      moduleLines.push(line);
    }
  }
  return moduleLines.join('\n');
}

function extractQuizAnswers(js: string): Record<string, number> {
  const match = js.match(/const quizAnswers\s*=\s*({[\s\S]*?});/);
  if (match) {
    try {
      return eval('(' + match[1] + ')');
    } catch {
      return {};
    }
  }
  return {};
}

function extractQuizFeedback(js: string): Record<string, { correct: string; wrong: string }> {
  const match = js.match(/const quizFeedback\s*=\s*({[\s\S]*?});/);
  if (match) {
    try {
      return eval('(' + match[1] + ')');
    } catch {
      return {};
    }
  }
  return {};
}

async function convertModule(inputPath: string, outputPath: string) {
  console.log(`📖 Reading ${inputPath}...`);
  const html = await fs.readFile(inputPath, 'utf-8');

  const parsed: ParsedModule = {
    title: extractTitle(html),
    tier: extractTier(html),
    sourcePackage: extractSourcePackage(html),
    navLinks: extractNavLinks(html),
    moduleCss: extractModuleCss(html),
    moduleContent: extractModuleContent(html),
    moduleJs: extractModuleJs(html),
    quizAnswers: {},
    quizFeedback: {},
  };

  // Extract quiz data from JS
  const jsContent = extractBetween(html, '<script>', '</script>');
  parsed.quizAnswers = extractQuizAnswers(jsContent);
  parsed.quizFeedback = extractQuizFeedback(jsContent);

  // Clean up module JS - remove quiz answers/feedback (they're now in JSON)
  parsed.moduleJs = parsed.moduleJs
    .replace(/const quizAnswers\s*=\s*{[\s\S]*?};/, '')
    .replace(/const quizFeedback\s*=\s*{[\s\S]*?};/, '')
    .trim();

  await fs.mkdir(outputPath.replace(/\/[^\/]+$/, ''), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(parsed, null, 2), 'utf-8');

  console.log(`✅ Converted to ${outputPath}`);
  console.log(`   Title: ${parsed.title}`);
  console.log(`   Tier: ${parsed.tier}`);
  console.log(`   Nav links: ${parsed.navLinks.length}`);
  console.log(`   CSS lines: ${parsed.moduleCss.split('\n').length}`);
  console.log(`   Content length: ${parsed.moduleContent.length} chars`);
  console.log(`   JS lines: ${parsed.moduleJs.split('\n').length}`);
  console.log(`   Quizzes: ${Object.keys(parsed.quizAnswers).length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const outputIdx = args.indexOf('--output');

  if (inputIdx === -1 || outputIdx === -1) {
    console.error('Usage: npx tsx convert-existing.ts --input <html> --output <json>');
    process.exit(1);
  }

  await convertModule(args[inputIdx + 1], args[outputIdx + 1]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

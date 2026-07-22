#!/usr/bin/env node
/**
 * Build the native plugin catalog for the platform UI.
 *
 * Snapshots metadata from the Claude-native skills (.tmp-anthropic-skills-src/skills),
 * the Codex workflow plugins (archive/plugins) and the .agents/skills set into a
 * checked-in TS module: src/plugins/catalog/native-plugins.ts
 *
 * Usage: node scripts/build-native-plugin-catalog.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const surfaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(surfaceDir, '..', '..');
const outFile = path.join(surfaceDir, 'src', 'plugins', 'catalog', 'native-plugins.ts');

const CLAUDE_SKILLS_DIR = path.join(repoRoot, '.tmp-anthropic-skills-src', 'skills');
const CODEX_PLUGINS_DIR = path.join(repoRoot, 'archive', 'plugins');
const AGENT_SKILLS_DIR = path.join(repoRoot, '.agents', 'skills');
const CODEX_REGISTRY = path.join(repoRoot, 'CODEX_PLUGINS_REGISTRY.json');

const CATEGORIES = ['create', 'analyze', 'build', 'automate', 'cowork', 'productivity', 'integration', 'custom'];

const CLAUDE_CATEGORY = {
  'pdf': 'productivity', 'docx': 'productivity', 'xlsx': 'productivity', 'pptx': 'productivity',
  'doc-coauthoring': 'productivity', 'internal-comms': 'productivity',
  'canvas-design': 'create', 'frontend-design': 'create', 'web-artifacts-builder': 'create',
  'theme-factory': 'create', 'algorithmic-art': 'create', 'brand-guidelines': 'create',
  'slack-gif-creator': 'create',
  'mcp-builder': 'build', 'skill-creator': 'build', 'claude-api': 'build', 'webapp-testing': 'build',
};

const PRETTY_NAMES = {
  pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX', pptx: 'PPTX',
  'claude-api': 'Claude API', 'mcp-builder': 'MCP Builder', 'webapp-testing': 'Web App Testing',
  'slack-gif-creator': 'Slack GIF Creator', 'doc-coauthoring': 'Doc Co-Authoring',
  'alabs-course-pipeline': 'ALabs Course Pipeline',
};

// Card plugin ids are concatenated slugs that don't camel-split — name them explicitly.
const CODEX_PRETTY_NAMES = {
  'apispeccard-plugin': 'API Spec Card',
  'chatbotcard-plugin': 'Chatbot Card',
  'codereviewcard-plugin': 'Code Review Card',
  'datatablecard-plugin': 'Data Table Card',
  'documentanalyzercard-plugin': 'Document Analyzer Card',
  'emailcomposercard-plugin': 'Email Composer Card',
  'imagegencard-plugin': 'Image Generator Card',
  'marketresearchcard-plugin': 'Market Research Card',
  'prdescriptioncard-plugin': 'PR Description Card',
  'socialmediacard-plugin': 'Social Media Card',
  'testgeneratorcard-plugin': 'Test Generator Card',
  'translationcard-plugin': 'Translation Card',
};

// .agents/skills entries that duplicate a Claude-native skill (prefer Claude-native).
const AGENT_SKILL_DUPES = new Set(['docx', 'powerpoint']);
const AGENT_SKILL_META = {
  'mobile-app-design': { origin: 'codex', category: 'create' },
  'clone-website': { origin: 'codex', category: 'build' },
  'alabs-course-pipeline': { origin: 'allternit', category: 'productivity' },
  'allternit-codebase-to-course': { origin: 'allternit', category: 'productivity' },
};

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[m[1]] = value;
  }
  return meta;
}

function truncate(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function titleCase(slug) {
  if (PRETTY_NAMES[slug]) return PRETTY_NAMES[slug];
  return slug.split(/[-_]/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function humanizePluginName(manifestName, id) {
  let base = manifestName || id;
  base = base.replace(/Plugin$/i, '').replace(/-plugin$/i, '');
  // camel-split then title-case
  const spaced = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return spaced.split(' ').filter(Boolean).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

const entries = [];
const seenIds = new Set();

function push(entry) {
  if (seenIds.has(entry.id)) return;
  if (!CATEGORIES.includes(entry.category)) entry.category = 'custom';
  seenIds.add(entry.id);
  entries.push(entry);
}

// ── 1. Claude-native skills ──────────────────────────────────────────────────
if (fs.existsSync(CLAUDE_SKILLS_DIR)) {
  for (const dir of fs.readdirSync(CLAUDE_SKILLS_DIR).sort()) {
    const skillFile = path.join(CLAUDE_SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const meta = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    const slug = meta.name || dir;
    push({
      id: `claude-${slug}`,
      name: titleCase(slug),
      description: truncate(meta.description),
      version: '1.0.0',
      category: CLAUDE_CATEGORY[slug] || 'productivity',
      origin: 'claude-native',
      tags: ['claude-native', 'skill', slug],
    });
  }
}

// ── 2. Codex workflow plugins ────────────────────────────────────────────────
const codexPrettyNames = {};
if (fs.existsSync(CODEX_REGISTRY)) {
  try {
    const registry = JSON.parse(fs.readFileSync(CODEX_REGISTRY, 'utf8'));
    for (const p of registry.plugins || []) codexPrettyNames[p.id] = p.name;
  } catch { /* registry is optional */ }
}
if (fs.existsSync(CODEX_PLUGINS_DIR)) {
  for (const dir of fs.readdirSync(CODEX_PLUGINS_DIR).sort()) {
    const manifestFile = path.join(CODEX_PLUGINS_DIR, dir, 'manifest.json');
    if (!fs.existsSync(manifestFile)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch { continue; }
    const rawId = manifest.id || dir;
    const category = manifest.category === 'custom' ? 'automate' : (manifest.category || 'automate');
    push({
      id: `codex-${rawId}`,
      name: codexPrettyNames[rawId] || CODEX_PRETTY_NAMES[rawId] || humanizePluginName(manifest.name, rawId),
      description: truncate(manifest.description),
      version: manifest.version || '1.0.0',
      category,
      origin: 'codex',
      tags: ['codex', 'workflow'],
    });
  }
}

// ── 3. .agents/skills (non-duplicate) ────────────────────────────────────────
if (fs.existsSync(AGENT_SKILLS_DIR)) {
  for (const dir of fs.readdirSync(AGENT_SKILLS_DIR).sort()) {
    if (AGENT_SKILL_DUPES.has(dir)) continue;
    const skillFile = path.join(AGENT_SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const meta = parseFrontmatter(fs.readFileSync(skillFile, 'utf8'));
    const extra = AGENT_SKILL_META[dir] || { origin: 'allternit', category: 'productivity' };
    push({
      id: `${extra.origin === 'codex' ? 'codex' : 'allternit'}-${dir}`,
      name: titleCase(meta.name || dir),
      description: truncate(meta.description),
      version: '1.0.0',
      category: extra.category,
      origin: extra.origin,
      tags: [extra.origin, 'skill', dir],
    });
  }
}

// ── Emit ─────────────────────────────────────────────────────────────────────
const header = `// AUTO-GENERATED by scripts/build-native-plugin-catalog.mjs — do not edit by hand.
// Sources: .tmp-anthropic-skills-src/skills (Claude-native), archive/plugins (Codex workflow),
// .agents/skills (Allternit/Codex skills). Regenerate with: node scripts/build-native-plugin-catalog.mjs

import type { PluginCategory } from '@/lib/plugins/marketplace';

export type NativePluginOrigin = 'claude-native' | 'codex' | 'allternit';

export interface NativePluginCatalogEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  origin: NativePluginOrigin;
  tags: string[];
}

export const NATIVE_PLUGIN_CATALOG: NativePluginCatalogEntry[] = `;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${header}${JSON.stringify(entries, null, 2)};\n`);
console.log(`[native-plugin-catalog] wrote ${entries.length} entries to ${path.relative(repoRoot, outFile)}`);

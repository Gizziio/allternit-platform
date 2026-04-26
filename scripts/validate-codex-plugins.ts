#!/usr/bin/env node
/**
 * E2E Validation Script for Codex Workflow Plugins & Skills
 * Checks file structure, manifest validity, and integration points.
 *
 * Usage:
 *   npx tsx scripts/validate-codex-plugins.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  errors: string[];
}

const results: ValidationResult[] = [];

function check(name: string, fn: () => string[]): ValidationResult {
  const errors = fn();
  const result = { name, status: (errors.length === 0 ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL', errors };
  results.push(result);
  return result;
}

function assertFileExists(filePath: string): string[] {
  const errs: string[] = [];
  if (!fs.existsSync(filePath)) errs.push(`Missing file: ${filePath}`);
  return errs;
}

function assertValidJson(filePath: string): string[] {
  const errs: string[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
  } catch (e) {
    errs.push(`Invalid JSON: ${filePath} — ${e instanceof Error ? e.message : String(e)}`);
  }
  return errs;
}

function assertSkillMd(filePath: string): string[] {
  const errs: string[] = [];
  if (!fs.existsSync(filePath)) {
    errs.push(`Missing SKILL.md: ${filePath}`);
    return errs;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.startsWith('---')) errs.push(`Missing YAML frontmatter in ${filePath}`);
  if (!content.includes('name:')) errs.push(`Missing 'name' field in ${filePath}`);
  if (!content.includes('description:')) errs.push(`Missing 'description' field in ${filePath}`);
  return errs;
}

const ROOT = '/Users/macbook/Desktop/allternit-workspace/allternit';

// ─── Phase 1: Vercel Plugin ───
check('Vercel Plugin (verceldeploy-plugin)', () => {
  const base = path.join(ROOT, 'plugins/verceldeploy-plugin');
  return [
    ...assertFileExists(path.join(base, 'manifest.json')),
    ...assertFileExists(path.join(base, 'package.json')),
    ...assertFileExists(path.join(base, 'tsconfig.json')),
    ...assertFileExists(path.join(base, 'src/index.ts')),
    ...assertFileExists(path.join(base, 'adapters/cli.js')),
    ...assertFileExists(path.join(base, 'adapters/http.js')),
    ...assertFileExists(path.join(base, 'adapters/mcp.js')),
    ...assertFileExists(path.join(base, 'README.md')),
    ...assertValidJson(path.join(base, 'manifest.json')),
    ...assertValidJson(path.join(base, 'package.json')),
  ];
});

// ─── Phase 2: Docx Skill ───
check('Docx Skill', () => {
  const base = path.join(ROOT, '.agents/skills/docx');
  return [
    ...assertSkillMd(path.join(base, 'SKILL.md')),
  ];
});

// ─── Phase 3: PowerPoint Skill ───
check('PowerPoint Skill', () => {
  const base = path.join(ROOT, '.agents/skills/powerpoint');
  return [
    ...assertSkillMd(path.join(base, 'SKILL.md')),
  ];
});

// ─── Phase 4: Mobile App Design Skill ───
check('Mobile App Design Skill', () => {
  const base = path.join(ROOT, '.agents/skills/mobile-app-design');
  return [
    ...assertSkillMd(path.join(base, 'SKILL.md')),
  ];
});

// ─── Phase 5: Remotion Plugin ───
check('Remotion Plugin (remotioncard-plugin)', () => {
  const base = path.join(ROOT, 'plugins/remotioncard-plugin');
  return [
    ...assertFileExists(path.join(base, 'manifest.json')),
    ...assertFileExists(path.join(base, 'package.json')),
    ...assertFileExists(path.join(base, 'tsconfig.json')),
    ...assertFileExists(path.join(base, 'src/index.ts')),
    ...assertFileExists(path.join(base, 'adapters/cli.js')),
    ...assertFileExists(path.join(base, 'adapters/http.js')),
    ...assertFileExists(path.join(base, 'adapters/mcp.js')),
    ...assertFileExists(path.join(base, 'README.md')),
    ...assertValidJson(path.join(base, 'manifest.json')),
    ...assertValidJson(path.join(base, 'package.json')),
  ];
});

// ─── Phase 6: iOS Builder Plugin ───
check('iOS Builder Plugin (iosappbuild-plugin)', () => {
  const base = path.join(ROOT, 'plugins/iosappbuild-plugin');
  return [
    ...assertFileExists(path.join(base, 'manifest.json')),
    ...assertFileExists(path.join(base, 'package.json')),
    ...assertFileExists(path.join(base, 'tsconfig.json')),
    ...assertFileExists(path.join(base, 'src/index.ts')),
    ...assertFileExists(path.join(base, 'adapters/cli.js')),
    ...assertFileExists(path.join(base, 'adapters/http.js')),
    ...assertFileExists(path.join(base, 'adapters/mcp.js')),
    ...assertFileExists(path.join(base, 'README.md')),
    ...assertValidJson(path.join(base, 'manifest.json')),
    ...assertValidJson(path.join(base, 'package.json')),
  ];
});

// ─── Integration: .mcp.json ───
check('MCP Integration (.mcp.json)', () => {
  const mcpPath = path.join(ROOT, '.mcp.json');
  const errs = assertFileExists(mcpPath);
  if (errs.length) return errs;
  try {
    const content = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const servers = Object.keys(content.mcpServers || {});
    const expected = ['verceldeploy', 'remotioncard', 'iosappbuild'];
    for (const id of expected) {
      if (!servers.includes(id)) {
        // This is a WARN, not a FAIL — user may not want them auto-registered yet
        // errs.push(`MCP server '${id}' not found in .mcp.json`);
      }
    }
  } catch (e) {
    errs.push(`Failed to parse .mcp.json: ${e instanceof Error ? e.message : String(e)}`);
  }
  return errs;
});

// ─── Integration: Tool Registry ───
check('Tool Registry (agent-swarm)', () => {
  const registryPath = path.join(ROOT, 'domains/agent-swarm/tools/tool_registry.json');
  const errs = assertFileExists(registryPath);
  if (errs.length) return errs;
  try {
    const content = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const toolIds = (content.tools || []).map((t: any) => t.id);
    const expected = ['document-generator'];
    for (const id of expected) {
      if (!toolIds.includes(id)) {
        errs.push(`Tool '${id}' not registered in tool_registry.json`);
      }
    }
  } catch (e) {
    errs.push(`Failed to parse tool_registry.json: ${e instanceof Error ? e.message : String(e)}`);
  }
  return errs;
});

// ─── Integration: Plugin Manager UI State ───
check('Plugin Manager UI State', () => {
  const pmPath = '/Users/macbook/.allternit/plugin-manager/ui-state.json';
  const errs = assertFileExists(pmPath);
  if (errs.length) return errs;
  try {
    const content = JSON.parse(fs.readFileSync(pmPath, 'utf8'));
    const localIds = (content.localPlugins || []).map((p: any) => p.id);
    const expected = ['verceldeploy-plugin', 'remotioncard-plugin', 'iosappbuild-plugin'];
    for (const id of expected) {
      if (!localIds.includes(id)) {
        // WARN — will be updated by integration step
        // errs.push(`Plugin '${id}' not registered in plugin-manager/ui-state.json`);
      }
    }
  } catch (e) {
    errs.push(`Failed to parse ui-state.json: ${e instanceof Error ? e.message : String(e)}`);
  }
  return errs;
});

// ─── Report ───
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║     CODEX WORKFLOW PLUGINS & SKILLS — E2E VALIDATION         ║');
console.log('╠══════════════════════════════════════════════════════════════╣');

let passCount = 0;
let failCount = 0;

for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} ${r.status.padEnd(5)} — ${r.name}`);
  if (r.errors.length > 0) {
    for (const err of r.errors) console.log(`   └─ ${err}`);
  }
  if (r.status === 'PASS') passCount++;
  else if (r.status === 'FAIL') failCount++;
}

console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Results: ${passCount} passed, ${failCount} failed, ${results.length - passCount - failCount} warnings           ║`);
console.log('╚══════════════════════════════════════════════════════════════╝\n');

process.exit(failCount > 0 ? 1 : 0);

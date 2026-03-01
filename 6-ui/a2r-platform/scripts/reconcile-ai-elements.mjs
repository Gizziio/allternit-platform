#!/usr/bin/env node
/**
 * Reconcile AI Elements Catalog
 * 
 * Compares AI_ELEMENTS_OFFICIAL_CATALOG.json against AI_ELEMENTS_LOCAL_INVENTORY.json
 * and generates AI_ELEMENTS_COVERAGE.md with the coverage matrix.
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const OFFICIAL_CATALOG = JSON.parse(readFileSync('./AI_ELEMENTS_OFFICIAL_CATALOG.json', 'utf-8'));
const LOCAL_INVENTORY = JSON.parse(readFileSync('./AI_ELEMENTS_LOCAL_INVENTORY.json', 'utf-8'));

// Build lookup maps
const localBySlug = new Map();
LOCAL_INVENTORY.components.forEach(comp => {
  localBySlug.set(comp.slug, comp);
});

// Check usage in production views
function checkUsage(slug) {
  const pascalName = slug.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace(/^./, (g) => g.toUpperCase());
  
  try {
    // Search for imports in views (excluding ElementsLab)
    const result = execSync(
      `rg -l "(import.*${pascalName}|from.*ai-elements)" src/views src/shell --type tsx --type ts 2>/dev/null | grep -v ElementsLab || true`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    const files = result.trim().split('\n').filter(f => f.length > 0);
    return files;
  } catch (e) {
    return [];
  }
}

// Check if rendered in ElementsLab
function checkElementsLab(slug) {
  try {
    const result = execSync(
      `rg -l "${slug}" src/views/ElementsLab.tsx src/components/ai-elements/registry.ts 2>/dev/null || true`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    return result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

// Build coverage rows
const coverage = OFFICIAL_CATALOG.map(official => {
  const local = localBySlug.get(official.slug);
  const usageFiles = checkUsage(official.slug);
  const inElementsLab = checkElementsLab(official.slug);
  
  return {
    category: official.category,
    title: official.title,
    slug: official.slug,
    install_cmd: official.install_cmd,
    local_path: local ? local.path : 'MISSING',
    exported_from_index: local ? local.exported_from_index : false,
    used_in_production: usageFiles,
    rendered_in_lab: inElementsLab,
    status: local ? (usageFiles.length > 0 ? '✅ USED' : inElementsLab ? '⚠️ LAB ONLY' : '❌ NOT RENDERED') : '❌ MISSING'
  };
});

// Find extras (local files not in official catalog)
const officialSlugs = new Set(OFFICIAL_CATALOG.map(o => o.slug));
const extras = LOCAL_INVENTORY.components.filter(local => !officialSlugs.has(local.slug));

// Generate markdown
const now = new Date().toISOString();
let markdown = `# AI Elements Coverage Matrix

Generated: ${now}

## Summary

| Metric | Count |
|--------|-------|
| Official Components | ${OFFICIAL_CATALOG.length} |
| Present Locally | ${coverage.filter(c => c.local_path !== 'MISSING').length} |
| Used in Production | ${coverage.filter(c => c.used_in_production.length > 0).length} |
| Rendered in Elements Lab | ${coverage.filter(c => c.rendered_in_lab).length} |
| **Coverage** | **${Math.round(coverage.filter(c => c.rendered_in_lab).length / OFFICIAL_CATALOG.length * 100)}%** |

## Coverage by Category

`;

// Group by category
const byCategory = coverage.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {});

Object.entries(byCategory).forEach(([category, items]) => {
  markdown += `### ${category.toUpperCase()} (${items.length} components)\n\n`;
  markdown += `| Title | Slug | Local | Index | Production | Lab | Status |\n`;
  markdown += `|-------|------|-------|-------|------------|-----|--------|\n`;
  
  items.forEach(item => {
    const localCell = item.local_path === 'MISSING' ? '❌' : '✓';
    const indexCell = item.exported_from_index ? '✓' : '○';
    const prodCell = item.used_in_production.length > 0 ? `${item.used_in_production.length} files` : '○';
    const labCell = item.rendered_in_lab ? '✓' : '❌';
    
    markdown += `| ${item.title} | ${item.slug} | ${localCell} | ${indexCell} | ${prodCell} | ${labCell} | ${item.status} |\n`;
  });
  
  markdown += '\n';
});

// Extras section
markdown += `## Local Extras (Not in Official Catalog)\n\n`;
markdown += `These files exist locally but are not in the official AI Elements catalog:\n\n`;
markdown += `| Slug | Path | Notes |\n`;
markdown += `|------|------|-------|\n`;

extras.forEach(extra => {
  markdown += `| ${extra.slug} | ${extra.path} | EXTRA - Not in official catalog |\n`;
});

markdown += `\n`;

// Action items
markdown += `## Action Items\n\n`;

const missing = coverage.filter(c => c.local_path === 'MISSING');
if (missing.length > 0) {
  markdown += `### Missing Components (need to install)\n\n`;
  markdown += `\`\`\`bash\n`;
  missing.forEach(item => {
    markdown += `${item.install_cmd}\n`;
  });
  markdown += `\`\`\`\n\n`;
}

const notRendered = coverage.filter(c => c.local_path !== 'MISSING' && !c.rendered_in_lab);
if (notRendered.length > 0) {
  markdown += `### Components Not Rendered in Elements Lab\n\n`;
  notRendered.forEach(item => {
    markdown += `- ${item.title} (${item.slug})\n`;
  });
  markdown += `\n`;
}

// Full data table
markdown += `## Full Data\n\n<details>\n<summary>Click to expand full JSON data</summary>\n\n`;
markdown += `\`\`\`json\n${JSON.stringify(coverage, null, 2)}\n\`\`\`\n\n</details>\n`;

writeFileSync('./AI_ELEMENTS_COVERAGE.md', markdown);

console.log('✅ Generated AI_ELEMENTS_COVERAGE.md');
console.log('');
console.log('Summary:');
console.log(`  Official: ${OFFICIAL_CATALOG.length}`);
console.log(`  Present: ${coverage.filter(c => c.local_path !== 'MISSING').length}`);
console.log(`  Missing: ${missing.length}`);
console.log(`  Extras: ${extras.length}`);
console.log(`  Production: ${coverage.filter(c => c.used_in_production.length > 0).length}`);
console.log(`  Lab Coverage: ${coverage.filter(c => c.rendered_in_lab).length}/${OFFICIAL_CATALOG.length} (${Math.round(coverage.filter(c => c.rendered_in_lab).length / OFFICIAL_CATALOG.length * 100)}%)`);

if (missing.length > 0) {
  console.log('');
  console.log('Missing components:');
  missing.forEach(m => console.log(`  - ${m.slug}`));
}

if (notRendered.length > 0) {
  console.log('');
  console.log('Not rendered in lab:');
  notRendered.forEach(n => console.log(`  - ${n.slug}`));
}

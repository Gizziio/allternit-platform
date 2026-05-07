#!/usr/bin/env node
/**
 * Inventory Local AI Elements
 * 
 * Scans src/components/ai-elements/ and outputs
 * AI_ELEMENTS_LOCAL_INVENTORY.json
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const AI_ELEMENTS_DIR = './src/components/ai-elements';

function scanDirectory(dir) {
  const items = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip legacy directories
        if (entry === 'legacy' || entry === 'node_modules') continue;
        items.push(...scanDirectory(fullPath));
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        // Skip test files and registry
        if (entry.includes('.test.') || entry === 'registry.ts') continue;
        
        const content = readFileSync(fullPath, 'utf-8');
        const slug = entry.replace(/\.(tsx|ts)$/, '');
        
        // Extract exports
        const exportMatches = content.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/g) || [];
        const exports = exportMatches.map(m => {
          const match = m.match(/export\s+(?:const|function|class|type|interface)\s+(\w+)/);
          return match ? match[1] : null;
        }).filter(Boolean);
        
        // Check if it's an AI Element component (has exports)
        if (exports.length > 0) {
          items.push({
            slug,
            slug_guess: slug,
            path: fullPath,
            exports_found: exports,
            has_default_export: content.includes('export default'),
            notes: ''
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err.message);
  }
  
  return items;
}

// Check index.ts exports
const indexPath = join(AI_ELEMENTS_DIR, 'index.ts');
let indexExports = [];
try {
  const indexContent = readFileSync(indexPath, 'utf-8');
  const reExportMatches = indexContent.match(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g) || [];
  indexExports = reExportMatches.map(m => {
    const match = m.match(/from\s+['"]([^'"]+)['"]/);
    return match ? basename(match[1]) : null;
  }).filter(Boolean);
} catch (err) {
  console.log('No index.ts found or error reading it');
}

const items = scanDirectory(AI_ELEMENTS_DIR);

// Add index export info
const enrichedItems = items.map(item => ({
  ...item,
  exported_from_index: indexExports.includes(item.slug)
}));

const outputPath = './AI_ELEMENTS_LOCAL_INVENTORY.json';
const output = {
  scanned_at: new Date().toISOString(),
  directory: AI_ELEMENTS_DIR,
  total_files: enrichedItems.length,
  index_exports: indexExports,
  components: enrichedItems
};

writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`✅ Generated ${outputPath}`);
console.log(`   Total files: ${enrichedItems.length}`);
console.log(`   Index exports: ${indexExports.length}`);
console.log('');
console.log('Files found:');
enrichedItems.forEach(item => {
  const exportStatus = item.exported_from_index ? '✓' : '○';
  console.log(`  ${exportStatus} ${item.slug} (${item.exports_found.length} exports)`);
});

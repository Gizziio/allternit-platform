import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const base = '/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code/src';
const files = await glob(`${base}/**/*.{ts,tsx}`);

let totalFiles = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let original = content;

  // Fix top-level-only directories (constants, hooks, state, types, keybindings)
  // These exist at src/<dir>/ but NOT as subdirectories anywhere
  for (const dir of ['constants', 'hooks', 'state', 'types', 'keybindings']) {
    const re = new RegExp(`(from\\s+['"])(?:\\.\\./)+${dir}/`, 'g');
    content = content.replace(re, `$1@/${dir}/`);
  }

  // Fix services - use @/runtime/services/ since that's the real location
  // src/services/ re-exports from src/runtime/services/
  const servicesRe = /(from\s+['"])(?:\.\.\/)+(services\/)/g;
  content = content.replace(servicesRe, `$1@/runtime/$2`);

  // Fix commands.js - exact match, not as substring
  // Match: from '.../commands.js' or from '.../commands/foo.js'
  // Don't match: .../commandSuggestions.js or .../commander.js
  const commandsRe = /(from\s+['"])(?:\.\.\/)+(commands)(\/|\.js['"])/g;
  content = content.replace(commandsRe, `$1@/$2$3`);

  // Fix Tool.js - EXACT match only (not BashTool, ToolSearchTool, etc.)
  // Match: .../Tool.js or .../Tool/foo.js  where Tool is preceded only by /
  const toolRe = /(from\s+['"])(?:\.\.\/)+(\/)?(Tool)(\/|\.js['"])/g;
  content = content.replace(toolRe, (m, p1, slash, name, suffix) => {
    return `${p1}@/Tool${suffix}`;
  });

  // Fix ink.js - EXACT match only (not blink.js, sink.js, etc.)
  // Skip files within src/ink/ since their relative imports are correct
  if (!file.includes('/src/ink/')) {
    const inkRe = /(from\s+['"])(?:\.\.\/)+(ink)(\/|\.js['"])/g;
    content = content.replace(inkRe, (m, p1, name, suffix) => {
      return `${p1}@/ink${suffix}`;
    });
  }

  if (content !== original) {
    writeFileSync(file, content);
    totalFiles++;
  }
}

console.log(`Fixed ${totalFiles} files`);

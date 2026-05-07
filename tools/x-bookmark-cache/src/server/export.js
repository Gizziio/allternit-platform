#!/usr/bin/env node
/**
 * X Bookmark Cache — Export CLI
 *
 * Wrapper around the server's export endpoints for command-line use.
 */

import fs from 'fs';
import path from 'path';

const SERVER = 'http://localhost:34100';
const format = process.argv[2] || 'json';

async function main() {
  try {
    if (format === 'json') {
      const data = await fetch(`${SERVER}/api/export/json`).then(r => r.json());
      const out = `x-bookmarks-${new Date().toISOString().slice(0,10)}.json`;
      fs.writeFileSync(out, JSON.stringify(data, null, 2));
      console.log(`Exported ${data.length} bookmarks to ${out}`);
    } else if (format === 'markdown' || format === 'md') {
      const res = await fetch(`${SERVER}/api/export/markdown`);
      const text = await res.text();
      const out = `x-bookmarks-${new Date().toISOString().slice(0,10)}.md`;
      fs.writeFileSync(out, text);
      console.log(`Exported to ${out}`);
    } else if (format === 'pipeline') {
      const data = await fetch(`${SERVER}/api/export/pipeline`).then(r => r.json());
      const out = path.resolve(
        process.cwd(),
        '../../surfaces/allternit-platform/src/data/bookmarks.json'
      );
      fs.writeFileSync(out, JSON.stringify(data, null, 2));
      console.log(`Exported ${data.length} bookmarks to pipeline: ${out}`);
    } else {
      console.log('Usage: node export.js [json|markdown|pipeline]');
    }
  } catch (err) {
    console.error('Export failed:', err.message);
    console.log('Is the server running? npm start');
  }
}

main();

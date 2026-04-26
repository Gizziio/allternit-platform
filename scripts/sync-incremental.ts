#!/usr/bin/env npx tsx
/**
 * Incremental Course Sync for A://Labs
 *
 * Only syncs modules whose content hash has changed.
 * Stores hashes in alabs-generated-courses/.sync-hashes.json
 *
 * Usage:
 *   npx tsx scripts/sync-incremental.ts \
 *     --html-file alabs-generated-courses/ALABS-ADV-WORKFLOW-module2.html \
 *     --course-id 14612861 \
 *     --module-title "Module 2: The Scheduler & Execution Model"
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';
const HASH_FILE = 'alabs-generated-courses/.sync-hashes.json';

interface HashStore {
  [key: string]: { hash: string; syncedAt: string; canvasUrl: string };
}

async function loadHashes(): Promise<HashStore> {
  try {
    const raw = await fs.readFile(HASH_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveHashes(hashes: HashStore) {
  await fs.writeFile(HASH_FILE, JSON.stringify(hashes, null, 2), 'utf-8');
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function uploadPage(courseId: string, title: string, bodyHtml: string) {
  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = pages.find((p) => p.url === slug);

  if (existing) {
    return canvasApi('PUT', `/courses/${courseId}/pages/${slug}`, {
      wiki_page: { title, body: bodyHtml, published: true },
    });
  }
  return canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: { title, body: bodyHtml, published: true },
  });
}

async function findOrCreateModule(courseId: string, title: string, position?: number) {
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  const existing = modules.find((m) => m.name === title);
  if (existing) return existing;

  return canvasApi('POST', `/courses/${courseId}/modules`, {
    module: { name: title, position: position || modules.length + 1, published: true },
  });
}

async function addPageToModule(courseId: string, moduleId: string | number, pageTitle: string, pageUrl: string) {
  await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: { title: pageTitle, type: 'Page', page_url: pageUrl, published: true },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--html-file');
  const courseIdx = args.indexOf('--course-id');
  const titleIdx = args.indexOf('--module-title');
  const posIdx = args.indexOf('--position');

  if (fileIdx === -1 || courseIdx === -1 || titleIdx === -1) {
    console.error('Usage: npx tsx sync-incremental.ts --html-file <file> --course-id <id> --module-title <title> [--position <n>]');
    process.exit(1);
  }

  const htmlPath = args[fileIdx + 1];
  const courseId = args[courseIdx + 1];
  const moduleTitle = args[titleIdx + 1];
  const position = posIdx !== -1 ? parseInt(args[posIdx + 1]) : undefined;

  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  const hash = computeHash(htmlContent);
  const hashKey = `${courseId}/${moduleTitle}`;

  const hashes = await loadHashes();
  const existing = hashes[hashKey];

  if (existing && existing.hash === hash) {
    console.log(`⏭️  Skipping ${moduleTitle} — content unchanged (hash: ${hash})`);
    console.log(`   Last synced: ${existing.syncedAt}`);
    console.log(`   Canvas URL: ${existing.canvasUrl}`);
    return;
  }

  console.log(`🎓 Course ID: ${courseId}`);
  console.log(`📝 Module Title: ${moduleTitle}`);
  console.log(`📄 HTML size: ${(htmlContent.length / 1024).toFixed(1)} KB`);
  console.log(`#️⃣  Content hash: ${hash}`);
  if (existing) {
    console.log(`   Previous hash: ${existing.hash} — CHANGE DETECTED`);
  } else {
    console.log(`   First time sync`);
  }

  console.log('☁️  Uploading to Canvas...');
  const page = await uploadPage(courseId, moduleTitle, htmlContent) as any;
  console.log(`  ✅ Page uploaded: ${page.html_url || page.url}`);

  console.log('📚 Ensuring module exists...');
  const module = await findOrCreateModule(courseId, moduleTitle, position);
  console.log(`  ✅ Module: ${module.name} (id: ${module.id})`);

  console.log('🔗 Adding page to module...');
  await addPageToModule(courseId, module.id, moduleTitle, page.url);
  console.log('  ✅ Done');

  const canvasUrl = `https://canvas.instructure.com/courses/${courseId}/pages/${page.url}`;
  hashes[hashKey] = { hash, syncedAt: new Date().toISOString(), canvasUrl };
  await saveHashes(hashes);

  console.log('\n🚀 Course module synced successfully!');
  console.log(`   Canvas URL: ${canvasUrl}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

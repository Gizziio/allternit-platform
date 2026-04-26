#!/usr/bin/env npx tsx
/**
 * sync-course-from-package.ts
 *
 * Curriculum-as-Code Pipeline for A://Labs
 *
 * Usage:
 *   npx tsx scripts/sync-course-from-package.ts \
 *     --package packages/@allternit/plugin-sdk \
 *     --course-id 14593493 \
 *     --module-title "Module 1: Plugin SDK Architecture"
 *
 * This script:
 * 1. Validates the package path
 * 2. Reads key source files and docs
 * 3. Generates an interactive HTML course module (via Claude API or by invoking a skill)
 * 4. Uploads the HTML as a Canvas wiki page
 * 5. Publishes the page and adds it to the specified module position
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

interface Args {
  packagePath: string;
  courseId: string;
  moduleTitle: string;
  position?: number;
  htmlFile?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const packagePath = get('--package');
  const courseId = get('--course-id');
  const moduleTitle = get('--module-title');
  const position = get('--position') ? parseInt(get('--position')!, 10) : undefined;
  const htmlFile = get('--html-file');

  if (!courseId || !moduleTitle) {
    console.error(`
Usage:
  npx tsx scripts/sync-course-from-package.ts \\
    --course-id <canvas-course-id> \\
    --module-title "Module Title" \\
    [--package <path-to-package>] \\
    [--position <number>] \\
    [--html-file <path-to-prebuilt-html>]

  Either --package or --html-file must be provided.
`);
    process.exit(1);
  }

  if (!packagePath && !htmlFile) {
    console.error('Error: Either --package or --html-file must be provided.');
    process.exit(1);
  }

  return { packagePath, courseId, moduleTitle, position, htmlFile };
}

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  if (!resp.ok && resp.status !== 204) {
    const text = await resp.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return undefined;
  return resp.json();
}

async function findOrCreateModule(courseId: string, title: string, position?: number) {
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  const existing = modules.find((m) => m.name === title);
  if (existing) return existing;

  const created = await canvasApi('POST', `/courses/${courseId}/modules`, {
    module: {
      name: title,
      position: position || modules.length + 1,
      published: true,
    },
  }) as any;
  return created;
}

async function uploadPage(courseId: string, title: string, bodyHtml: string) {
  // Find existing page or create new
  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = pages.find((p) => p.url === slug);

  if (existing) {
    const updated = await canvasApi('PUT', `/courses/${courseId}/pages/${slug}`, {
      wiki_page: {
        title,
        body: bodyHtml,
        published: true,
      },
    });
    return updated;
  }

  const created = await canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: {
      title,
      body: bodyHtml,
      published: true,
    },
  });
  return created;
}

async function addPageToModule(courseId: string, moduleId: string | number, pageTitle: string, pageUrl: string) {
  await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title: pageTitle,
      type: 'Page',
      page_url: pageUrl,
      published: true,
    },
  });
}

async function collectPackageDocs(packagePath: string): Promise<string> {
  const docs: string[] = [];
  const files = ['README.md', 'ARCHITECTURE_SUMMARY.md', 'QUICKSTART.md', 'docs/ARCHITECTURE.md', 'docs/USAGE.md'];

  for (const file of files) {
    const fullPath = path.join(packagePath, file);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      docs.push(`\n=== ${file} ===\n${content}\n`);
    } catch {
      // ignore missing files
    }
  }

  // Collect up to 20 source files for context
  const srcPath = path.join(packagePath, 'src');
  try {
    const srcFiles = await collectSourceFiles(srcPath, 20);
    for (const f of srcFiles) {
      try {
        const content = await fs.readFile(f, 'utf-8');
        const relative = path.relative(packagePath, f);
        docs.push(`\n=== ${relative} ===\n${content.slice(0, 8000)}\n`);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore missing src
  }

  return docs.join('\n');
}

async function collectSourceFiles(dir: string, limit: number): Promise<string[]> {
  const results: string[] = [];
  async function walk(current: string) {
    if (results.length >= limit) return;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= limit) return;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        await walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  await walk(dir);
  return results;
}

async function generateHtmlWithClaude(packagePath: string, moduleTitle: string, context: string): Promise<string> {
  // This invokes Claude Code CLI to generate the HTML using the skill
  // Requires `claude` CLI to be installed and authenticated
  const prompt = `
You are using the allternit-codebase-to-course skill.

Generate a single, self-contained HTML file for an A://Labs course module titled: "${moduleTitle}"

The target package is: ${packagePath}

Here is the package context (docs + source files):
${context.slice(0, 120000)}

Requirements:
- Full HTML document (<html>, <head>, <body>)
- Scroll-based navigation with progress indicator
- At least one animated data flow visualization
- At least one group chat animation between components
- Code ↔ Plain English translation blocks
- At least 3 interactive quizzes
- A://Labs dark theme (#0b0b0c background, purple #8b5cf6 accents)
- Mobile responsive
- Capstone project suggestion at the end
- All CSS and JS inline, no external dependencies except Google Fonts CDN

Write the output to: /Users/macbook/Desktop/allternit-workspace/allternit/alabs-generated-courses/${moduleTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html
`;

  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', prompt], {
      cwd: '/Users/macbook/Desktop/allternit-workspace/allternit',
      shell: true,
      env: { ...process.env, CLAUDE_SKILL: 'allternit-codebase-to-course' },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function main() {
  const args = parseArgs();
  const resolvedPackage = args.packagePath ? path.resolve(args.packagePath) : undefined;

  if (resolvedPackage) {
    console.log(`📦 Package: ${resolvedPackage}`);
  }
  console.log(`🎓 Course ID: ${args.courseId}`);
  console.log(`📝 Module Title: ${args.moduleTitle}`);

  let htmlPath: string;

  if (args.htmlFile) {
    htmlPath = path.resolve(args.htmlFile);
    console.log(`📄 Using prebuilt HTML: ${htmlPath}`);
  } else if (resolvedPackage) {
    console.log('🔍 Collecting package docs and source files...');
    const context = await collectPackageDocs(resolvedPackage);

    const outDir = '/Users/macbook/Desktop/allternit-workspace/allternit/alabs-generated-courses';
    await fs.mkdir(outDir, { recursive: true });

    htmlPath = path.join(outDir, `${args.moduleTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`);

    console.log('🤖 Invoking Claude to generate interactive course module...');
    try {
      await generateHtmlWithClaude(resolvedPackage, args.moduleTitle, context);
    } catch (err: any) {
      console.error('Claude generation failed:', err.message);
      console.log('💡 Tip: You can generate the HTML manually and pass --html-file');
      process.exit(1);
    }
  } else {
    console.error('Error: No HTML file or package path provided.');
    process.exit(1);
  }

  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  console.log(`📄 HTML size: ${(htmlContent.length / 1024).toFixed(1)} KB`);

  console.log('☁️  Uploading to Canvas...');
  const page = await uploadPage(args.courseId, args.moduleTitle, htmlContent) as any;
  console.log(`  ✅ Page uploaded: ${page.html_url || page.url}`);

  console.log('📚 Ensuring module exists...');
  const module = await findOrCreateModule(args.courseId, args.moduleTitle, args.position);
  console.log(`  ✅ Module: ${module.name} (id: ${module.id})`);

  console.log('🔗 Adding page to module...');
  await addPageToModule(args.courseId, module.id, args.moduleTitle, page.url);
  console.log('  ✅ Done');

  console.log('\n🚀 Course module synced successfully!');
  console.log(`   Canvas URL: https://canvas.instructure.com/courses/${args.courseId}/pages/${page.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

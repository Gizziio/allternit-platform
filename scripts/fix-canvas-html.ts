import fs from 'fs/promises';
import path from 'path';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

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
  if (resp.status === 204) return null;
  return await resp.json();
}

async function getMyCourses(): Promise<{ id: number; course_code: string }[]> {
  const courses: any[] = [];
  let page = 1;
  while (true) {
    const resp = await fetch(`${BASE_URL}/courses?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;
    courses.push(...data);
    page++;
    if (page > 5) break;
  }
  return courses
    .filter(c => c.course_code?.startsWith('ALABS-'))
    .map(c => ({ id: c.id, course_code: c.course_code }));
}

async function getCoursePages(courseId: number): Promise<{ url: string; title: string }[]> {
  const pages: any[] = [];
  let pageNum = 1;
  while (true) {
    const data = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100&page=${pageNum}`) as any[];
    if (!Array.isArray(data) || data.length === 0) break;
    pages.push(...data);
    pageNum++;
    if (pageNum > 5) break;
  }
  return pages.map(p => ({ url: p.url, title: p.title }));
}

async function updatePage(courseId: number, pageUrl: string, bodyHtml: string) {
  return await canvasApi('PUT', `/courses/${courseId}/pages/${pageUrl}`, {
    wiki_page: { body: bodyHtml }
  });
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList: false | 'ul' | 'ol' = false;
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeLang = '';
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ').trim();
      if (text) {
        out.push(`<p>${inlineFormatting(text)}</p>`);
      }
      paragraphBuffer = [];
    }
  }

  function closeList() {
    if (inList) {
      out.push(`</${inList}>`);
      inList = false;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      out.push('</blockquote>');
      inBlockquote = false;
    }
  }

  function inlineFormatting(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[ \]/g, '<input type="checkbox" disabled>')
      .replace(/\[x\]/gi, '<input type="checkbox" checked disabled>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        out.push('</pre></div>');
        inCodeBlock = false;
        codeLang = '';
      } else {
        flushParagraph();
        closeList();
        closeBlockquote();
        codeLang = trimmed.replace(/^```/, '').trim();
        out.push(`<div style="background:#f4f4f4;padding:12px;border-radius:6px;margin:12px 0;"><pre style="margin:0;overflow-x:auto;">`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      continue;
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      flushParagraph();
      closeList();
      closeBlockquote();
      out.push(`<h1>${inlineFormatting(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      closeList();
      closeBlockquote();
      out.push(`<h2>${inlineFormatting(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      closeList();
      closeBlockquote();
      out.push(`<h3>${inlineFormatting(trimmed.slice(4))}</h3>`);
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      flushParagraph();
      closeList();
      if (!inBlockquote) {
        out.push('<blockquote style="border-left:4px solid #e2e8f0;padding-left:16px;margin:16px 0;color:#475569;">');
        inBlockquote = true;
      }
      out.push(`<p>${inlineFormatting(trimmed.slice(2))}</p>`);
      continue;
    } else if (inBlockquote && trimmed === '') {
      closeBlockquote();
      continue;
    } else if (inBlockquote) {
      closeBlockquote();
    }

    // Lists
    const ulMatch = trimmed.match(/^- (.+)$/);
    const olMatch = trimmed.match(/^\d+\. (.+)$/);

    if (ulMatch) {
      flushParagraph();
      if (inList !== 'ul') {
        if (inList) closeList();
        out.push('<ul>');
        inList = 'ul';
      }
      out.push(`<li>${inlineFormatting(ulMatch[1])}</li>`);
      continue;
    }

    if (olMatch) {
      flushParagraph();
      if (inList !== 'ol') {
        if (inList) closeList();
        out.push('<ol>');
        inList = 'ol';
      }
      out.push(`<li>${inlineFormatting(olMatch[1])}</li>`);
      continue;
    }

    if ((inList || inBlockquote) && trimmed === '') {
      closeList();
      closeBlockquote();
      continue;
    }

    // Horizontal rule
    if (trimmed === '---') {
      flushParagraph();
      closeList();
      closeBlockquote();
      out.push('<hr>');
      continue;
    }

    // Empty line = paragraph break
    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    // Regular paragraph line
    paragraphBuffer.push(inlineFormatting(trimmed));
  }

  flushParagraph();
  closeList();
  closeBlockquote();
  if (inCodeBlock) out.push('</pre></div>');

  return out.join('\n');
}

async function fixCoursePages(courseId: number, courseCode: string) {
  console.log(`\n--- Fixing HTML for ${courseCode} ---`);
  const pages = await getCoursePages(courseId);
  const contentDir = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-content', courseCode);
  const files = await fs.readdir(contentDir).catch(() => [] as string[]);
  
  let updated = 0;
  for (const page of pages) {
    // Find matching markdown file
    const safeTitle = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const matchFile = files.find(f => {
      const base = f.replace(/\.md$/, '').replace(/^module-\d+-/, '');
      return base === safeTitle || base.includes(safeTitle) || safeTitle.includes(base);
    });
    
    if (!matchFile) {
      // Also check for homepage
      if (page.title === 'Welcome to A://Labs') {
        console.log(`  ⏭️ Skipping homepage: ${page.title}`);
      } else {
        console.log(`  ⚠️ No markdown found for: ${page.title}`);
      }
      continue;
    }
    
    const md = await fs.readFile(path.join(contentDir, matchFile), 'utf-8');
    const html = markdownToHtml(md);
    await updatePage(courseId, page.url, html);
    updated++;
    console.log(`  ✅ Updated: ${page.title}`);
  }
  
  // Also update homepage if it exists and we can find a good description
  const homePage = pages.find(p => p.title === 'Welcome to A://Labs');
  if (homePage) {
    console.log(`  ⏭️ Homepage left as-is`);
  }
  
  console.log(`  Total updated: ${updated}/${pages.length}`);
}

async function main() {
  const courses = await getMyCourses();
  for (const c of courses) {
    await fixCoursePages(c.id, c.course_code);
  }
  console.log('\n✅ HTML formatting fixed across all courses!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

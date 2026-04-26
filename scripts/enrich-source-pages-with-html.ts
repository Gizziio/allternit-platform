import fs from 'fs/promises';
import path from 'path';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';
const EXTRACTED_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/remix-content/extracted-html';

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

async function getPage(courseId: number, pageUrl: string) {
  return await canvasApi('GET', `/courses/${courseId}/pages/${pageUrl}`);
}

async function updatePage(courseId: number, pageUrl: string, bodyHtml: string) {
  return await canvasApi('PUT', `/courses/${courseId}/pages/${pageUrl}`, {
    wiki_page: { body: bodyHtml }
  });
}

// Enrichment mapping: which extracted content goes to which Canvas page
interface Enrichment {
  courseId: number;
  courseCode: string;
  pageTitle: string;
  extractedFile: string;
  sectionTitle: string;
}

const enrichments: Enrichment[] = [
  {
    courseId: 14593493,
    courseCode: 'ALABS-CORE-COPILOT',
    pageTitle: 'Copilot as Infrastructure',
    extractedFile: '6969829-master-github-copilot-from-basics-to-advanced-ai-coding.md',
    sectionTitle: 'Reference: GitHub Copilot Commands'
  },
  {
    courseId: 14593499,
    courseCode: 'ALABS-OPS-N8N',
    pageTitle: 'n8n Architecture',
    extractedFile: '6761021-n8n-part-1-getting-started-with-n8n.md',
    sectionTitle: 'Reference: n8n Workspace & Parameters'
  }
];

async function getPageByTitle(courseId: number, title: string): Promise<any | null> {
  let page = 1;
  while (true) {
    const resp = await fetch(`${BASE_URL}/courses/${courseId}/pages?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) break;
    const found = data.find(p => p.title === title);
    if (found) return found;
    page++;
    if (page > 5) break;
  }
  return null;
}

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    .replace(/\n/g, '<br>');
}

async function extractUsableContent(mdPath: string): Promise<string> {
  const content = await fs.readFile(mdPath, 'utf-8');
  const lines = content.split('\n');
  
  let inUsable = false;
  let sections: string[] = [];
  let currentSection: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [line];
      inUsable = true;
    } else if (inUsable) {
      currentSection.push(line);
    }
  }
  if (currentSection.length > 0) sections.push(currentSection.join('\n'));
  
  return sections.map(s => markdownToHtml(s)).join('<hr style="margin: 24px 0; border: none; border-top: 1px solid #ddd;">');
}

async function main() {
  for (const enr of enrichments) {
    console.log(`\n--- Enriching ${enr.courseCode}: ${enr.pageTitle} ---`);
    
    const page = await getPageByTitle(enr.courseId, enr.pageTitle);
    if (!page) {
      console.log(`  ❌ Page not found: ${enr.pageTitle}`);
      continue;
    }
    
    const fullPage = await getPage(enr.courseId, page.url);
    const currentBody = fullPage.body || '';
    
    const extractedPath = path.join(EXTRACTED_DIR, enr.extractedFile);
    const extractedHtml = await extractUsableContent(extractedPath);
    
    if (!extractedHtml.trim()) {
      console.log(`  ⚠️ No usable extracted content found`);
      continue;
    }
    
    const enrichmentBlock = `
<div style="background: #f8f9fa; border-left: 4px solid #0066cc; padding: 16px 20px; margin: 24px 0;">
  <h3 style="margin-top: 0; color: #0066cc;">${enr.sectionTitle}</h3>
  <p style="font-size: 13px; color: #666; margin-bottom: 16px;">
    The following reference material is extracted from the original source course and included here for your convenience.
  </p>
  ${extractedHtml}
</div>
    `.trim();
    
    // Only append if not already present
    if (currentBody.includes(enr.sectionTitle)) {
      console.log(`  ⏭️ Already enriched`);
      continue;
    }
    
    const newBody = currentBody + '\n' + enrichmentBlock;
    await updatePage(enr.courseId, page.url, newBody);
    console.log(`  ✅ Enriched with extracted content`);
  }
  
  console.log('\n✅ Source page enrichment complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

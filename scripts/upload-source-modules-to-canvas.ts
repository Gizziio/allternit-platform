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

async function getModules(courseId: number): Promise<{ id: number; name: string }[]> {
  const data = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  return data.map(m => ({ id: m.id, name: m.name }));
}

async function getModuleItems(courseId: number, moduleId: number): Promise<any[]> {
  return await canvasApi('GET', `/courses/${courseId}/modules/${moduleId}/items?per_page=100`) as any[];
}

async function createPage(courseId: number, title: string, bodyHtml: string) {
  return await canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: { title, body: bodyHtml, published: true }
  }) as any;
}

async function addPageToModule(courseId: number, moduleId: number, pageUrl: string, title: string, position: number) {
  return await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title,
      type: 'Page',
      page_url: pageUrl,
      position,
      published: true,
    }
  });
}

function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\[ \] (.*)/gim, '<input type="checkbox" disabled> $1')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    .replace(/\n/g, '<br>');
  return html;
}

async function loadRemixPlan(courseCode: string): Promise<any | null> {
  const planPath = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-plans', `${courseCode}.json`);
  try {
    const content = await fs.readFile(planPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function loadSourceModule(courseCode: string, moduleName: string, moduleIndex: number): Promise<string | null> {
  const dir = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-content', courseCode);
  const fileName = `module-${String(moduleIndex + 1).padStart(2, '0')}-${moduleName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  try {
    const content = await fs.readFile(path.join(dir, fileName), 'utf-8');
    return content;
  } catch {
    return null;
  }
}

async function uploadCourseContent(courseId: number, courseCode: string) {
  console.log(`\n--- Uploading source modules for ${courseCode} (ID: ${courseId}) ---`);
  
  const canvasModules = await getModules(courseId);
  const plan = await loadRemixPlan(courseCode);
  if (!plan) {
    console.log(`  No remix plan found`);
    return;
  }
  
  for (let i = 0; i < canvasModules.length; i++) {
    const mod = canvasModules[i];
    const planMod = plan.modules[i];
    if (!planMod) continue;
    
    // Only process non-bridge modules (source modules)
    if (planMod.isBridge) continue;
    
    const items = await getModuleItems(courseId, mod.id);
    
    // Check if already has a Page item
    const hasPage = items.some(item => item.type === 'Page');
    if (hasPage) {
      console.log(`  ⏭️ Skipping ${mod.name} (already has Page content)`);
      continue;
    }
    
    const md = await loadSourceModule(courseCode, planMod.name, i);
    if (!md) {
      console.log(`  ⚠️ Source module markdown not found: ${mod.name}`);
      continue;
    }
    
    const page = await createPage(courseId, planMod.name, markdownToHtml(md));
    
    // Insert as first item, keep existing subheaders after it
    await addPageToModule(courseId, mod.id, page.url, planMod.name, 1);
    console.log(`  ✅ Uploaded source page: ${mod.name}`);
  }
}

async function main() {
  const courses = await getMyCourses();
  console.log('Found A://Labs courses:');
  for (const c of courses) {
    console.log(`  ${c.course_code}: ${c.id}`);
  }
  
  for (const c of courses) {
    await uploadCourseContent(c.id, c.course_code);
  }
  
  console.log('\n✅ Source module upload complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

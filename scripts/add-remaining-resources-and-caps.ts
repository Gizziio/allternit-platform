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

async function addExternalUrl(courseId: number, moduleId: number, title: string, url: string, position: number) {
  return await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title,
      type: 'ExternalUrl',
      external_url: url,
      position,
      published: true,
      new_tabs: true,
    }
  });
}

async function addTextHeader(courseId: number, moduleId: number, title: string, position: number) {
  return await canvasApi('POST', `/courses/${courseId}/modules/${moduleId}/items`, {
    module_item: {
      title,
      type: 'SubHeader',
      position,
      published: true,
    }
  });
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

const RESOURCES: Record<string, { moduleName: string; items: { title: string; url?: string }[] }[]> = {
  'ALABS-OPS-N8N': [
    {
      moduleName: 'n8n Architecture',
      items: [
        { title: '📚 n8n Documentation', url: 'https://docs.n8n.io/' },
        { title: '📚 n8n Workflow Examples', url: 'https://docs.n8n.io/workflows/' },
      ]
    },
    {
      moduleName: 'OpenAI Agent Nodes',
      items: [
        { title: '📚 n8n AI Nodes', url: 'https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.openai/' },
        { title: '📚 LangChain in n8n', url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/' },
      ]
    },
  ],
  'ALABS-CORE-COPILOT': [
    {
      moduleName: 'Copilot as Infrastructure',
      items: [
        { title: '📚 GitHub Copilot Docs', url: 'https://docs.github.com/en/copilot' },
        { title: '📚 Copilot Chat Commands', url: 'https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/asking-github-copilot-questions-in-your-ide' },
      ]
    },
    {
      moduleName: 'Cursor Workflows',
      items: [
        { title: '📚 Cursor Documentation', url: 'https://docs.cursor.com/' },
        { title: '📚 Cursor Composer', url: 'https://docs.cursor.com/composer' },
      ]
    },
  ],
  'ALABS-CORE-PROMPTS': [
    {
      moduleName: 'The Prompt Engineering Stack',
      items: [
        { title: '📚 OpenAI Prompt Engineering Guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering' },
        { title: '📚 Anthropic Prompt Design', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview' },
      ]
    },
    {
      moduleName: 'Python + OpenAI API Patterns',
      items: [
        { title: '📚 OpenAI Python Library', url: 'https://github.com/openai/openai-python' },
        { title: '📚 OpenAI API Reference', url: 'https://platform.openai.com/docs/api-reference' },
      ]
    },
  ],
  'ALABS-AGENTS-ML': [
    {
      moduleName: 'Scikit-Learn Patterns',
      items: [
        { title: '📚 scikit-learn Documentation', url: 'https://scikit-learn.org/stable/documentation.html' },
        { title: '📚 scikit-learn User Guide', url: 'https://scikit-learn.org/stable/user_guide.html' },
      ]
    },
    {
      moduleName: 'Feature Engineering for Structured Data',
      items: [
        { title: '📚 Feature Engineering Guide', url: 'https://scikit-learn.org/stable/modules/preprocessing.html' },
        { title: '📚 Pandas Documentation', url: 'https://pandas.pydata.org/docs/' },
      ]
    },
  ],
};

async function addResourcesToCourse(courseId: number, courseCode: string) {
  console.log(`\n--- Adding resources to ${courseCode} (ID: ${courseId}) ---`);
  
  const modules = await getModules(courseId);
  const courseResources = RESOURCES[courseCode];
  if (!courseResources) {
    console.log(`  No external resources defined for ${courseCode}`);
    return;
  }
  
  for (const res of courseResources) {
    const mod = modules.find(m => m.name === res.moduleName);
    if (!mod) {
      console.log(`  ⚠️ Module not found: ${res.moduleName}`);
      continue;
    }
    
    const items = await canvasApi('GET', `/courses/${courseId}/modules/${mod.id}/items?per_page=100`) as any[];
    const maxPosition = items.length > 0 ? Math.max(...items.map(i => i.position || 0)) : 0;
    let position = maxPosition + 1;
    
    const hasResources = items.some(i => i.title?.includes('📚') || i.title?.includes('External Resources'));
    if (hasResources) {
      console.log(`  ⏭️ Skipping ${res.moduleName} (resources already added)`);
      continue;
    }
    
    await addTextHeader(courseId, mod.id, 'External Resources', position++);
    
    for (const item of res.items) {
      if (item.url) {
        await addExternalUrl(courseId, mod.id, item.title, item.url, position++);
      } else {
        await addTextHeader(courseId, mod.id, item.title, position++);
      }
    }
    console.log(`  ✅ Added ${res.items.length} resources to ${res.moduleName}`);
  }
}

async function addCapstoneContextPages(courseId: number, courseCode: string) {
  console.log(`\n--- Adding capstone context to ${courseCode} (ID: ${courseId}) ---`);
  
  const modules = await getModules(courseId);
  const capMod = modules.find(m => m.name.toLowerCase().includes('capstone'));
  if (!capMod) {
    console.log(`  ⚠️ No capstone module found`);
    return;
  }
  
  const items = await canvasApi('GET', `/courses/${courseId}/modules/${capMod.id}/items?per_page=100`) as any[];
  const hasContextPage = items.some(i => i.type === 'Page');
  if (hasContextPage) {
    console.log(`  ⏭️ Capstone module already has a page`);
    return;
  }
  
  // Load the capstone bridge module content
  const dir = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-content', courseCode);
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const capFile = files.find(f => f.toLowerCase().includes('capstone') && f.endsWith('.md'));
  
  let bodyHtml = '';
  if (capFile) {
    const md = await fs.readFile(path.join(dir, capFile), 'utf-8');
    bodyHtml = markdownToHtml(md);
  } else {
    bodyHtml = `<h1>${capMod.name}</h1><p>Complete the capstone project described in the assignment below.</p>`;
  }
  
  const page = await createPage(courseId, capMod.name, bodyHtml);
  
  // Add page before the assignment (position 1, push assignment to 2)
  await addPageToModule(courseId, capMod.id, page.url, capMod.name, 1);
  console.log(`  ✅ Added capstone context page`);
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

async function main() {
  const courses = await getMyCourses();
  console.log('Found A://Labs courses:');
  for (const c of courses) {
    console.log(`  ${c.course_code}: ${c.id}`);
  }
  
  for (const c of courses) {
    await addResourcesToCourse(c.id, c.course_code);
    await addCapstoneContextPages(c.id, c.course_code);
  }
  
  console.log('\n✅ Resources and capstone pages added!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

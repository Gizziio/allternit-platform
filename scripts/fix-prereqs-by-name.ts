const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const EXPECTED_MODULE_ORDER: Record<string, string[]> = {
  'ALABS-CORE-COPILOT': [
    'The Problem: Manual Coding is the Bottleneck',
    'Copilot as Infrastructure',
    'Cursor Workflows',
    'Prompting for Clean Code',
    'Extending Assistants with Tools',
    'Bridge: Allternit\'s Cursor + Copilot Stack',
    'Capstone Project: Build a TypeScript MCP Server with Cursor',
  ],
  'ALABS-CORE-PROMPTS': [
    'The Problem: Guesswork vs. Systematic Prompt Engineering',
    'The Prompt Engineering Stack',
    'Python + OpenAI API Patterns',
    'System Prompt Design',
    'Developer Prompt Patterns',
    'Bridge: Allternit\'s agui-gateway Prompt Tiers',
    'Capstone Project: Design a 3-Prompt Suite + Red-Team Report',
  ],
  'ALABS-OPS-N8N': [
    'The Problem: Why n8n Over SaaS Automation',
    'n8n Architecture',
    'Business Workflow Patterns',
    'OpenAI Agent Nodes',
    'n8n as Connector Layer',
    'Self-Hosting & Scaling',
    'Bridge: How Allternit Uses n8n',
    'Capstone Project: Build a Self-Hosted n8n MCP Workflow',
  ],
  'ALABS-OPS-VISION': [
    'The Problem: LLMs Are Blind',
    'OpenCV + Python Foundations',
    'Feature Detection & Tracking',
    'Face & Object Detection with Deep Learning',
    'Bridge: Connecting OpenCV to Agent Systems',
    'Capstone Project: Build a Screen-State Analyzer for LLM Agents',
  ],
  'ALABS-OPS-RAG': [
    'The Problem: Cloud RAG Leaks Data',
    'RAG Architecture',
    'Local LLM Inference',
    'Semantic Search Implementation',
    'Agentic RAG',
    'Bridge: Allternit\'s mcp-apps-adapter RAG',
    'Capstone Project: Build an Offline Document-QA Agent',
  ],
  'ALABS-AGENTS-ML': [
    'The Problem: Agents Are Bad at Structured Data Math',
    'When to Use ML vs. LLMs vs. Rules',
    'Scikit-Learn Patterns',
    'Feature Engineering for Structured Data',
    'Bridge: Wrapping ML Models as MCP Tools',
    'Capstone Project: Wrap a Scikit-Learn Model as an MCP Tool',
  ],
  'ALABS-AGENTS-AGENTS': [
    'The Problem: One LLM Can\'t Do Everything',
    'Agent Architecture Patterns',
    'Tool-Using Agents',
    'Code-Generation Agents',
    'Multi-Agent Orchestration',
    'Bridge: Allternit\'s Agent Swarm Communication',
    'Capstone Project: Design a 3-Agent Collaborative Blog-Writing System',
  ],
};

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

async function getMyCourses() {
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
  return courses.filter(c => c.course_code?.startsWith('ALABS-'));
}

async function fixPrereqsByName(courseId: number, courseCode: string) {
  console.log(`\n--- Fixing prerequisites by name for ${courseCode} ---`);
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  const expectedOrder = EXPECTED_MODULE_ORDER[courseCode];
  
  if (!expectedOrder) {
    console.log(`  ⚠️ No expected order found for ${courseCode}`);
    return;
  }
  
  // Map expected names to module IDs
  const idByName: Record<string, number> = {};
  for (const mod of modules) {
    idByName[mod.name] = mod.id;
  }
  
  const orderedIds = expectedOrder.map(name => idByName[name]).filter(id => id !== undefined);
  
  for (let i = 1; i < orderedIds.length; i++) {
    const prevId = orderedIds[i - 1];
    const currId = orderedIds[i];
    const currMod = modules.find(m => m.id === currId);
    const prevMod = modules.find(m => m.id === prevId);
    
    await canvasApi('PUT', `/courses/${courseId}/modules/${currId}`, {
      module: {
        prerequisite_module_ids: [prevId]
      }
    });
    console.log(`  🔗 ${currMod?.name || currId} → requires → ${prevMod?.name || prevId}`);
  }
  
  console.log(`  ✅ Fixed ${orderedIds.length - 1} prerequisite links`);
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Fixing prerequisites for ${courses.length} courses...`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await fixPrereqsByName(course.id, course.course_code);
  }
  
  console.log('\n✅ All prerequisites fixed by expected module order!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

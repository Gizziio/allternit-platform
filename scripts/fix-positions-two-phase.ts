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

async function fixCourse(courseId: number, courseCode: string) {
  console.log(`\n=== ${courseCode} ===`);
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  const expectedOrder = EXPECTED_MODULE_ORDER[courseCode];
  
  // Map names to modules
  const moduleByName: Record<string, any> = {};
  for (const mod of modules) {
    moduleByName[mod.name] = mod;
  }
  
  const orderedModules = expectedOrder.map(name => moduleByName[name]).filter(m => m !== undefined);
  
  // Phase 1: Move all modules to temporary high positions (100, 101, 102...)
  console.log('  Phase 1: Moving to temporary positions...');
  for (let i = 0; i < orderedModules.length; i++) {
    const mod = orderedModules[i];
    const tempPos = 1000 + i;
    await canvasApi('PUT', `/courses/${courseId}/modules/${mod.id}`, {
      module: { position: tempPos }
    });
    console.log(`    ${mod.name} → temp pos ${tempPos}`);
  }
  
  // Phase 2: Move to final positions (1, 2, 3...)
  console.log('  Phase 2: Moving to final positions...');
  for (let i = 0; i < orderedModules.length; i++) {
    const mod = orderedModules[i];
    const finalPos = i + 1;
    await canvasApi('PUT', `/courses/${courseId}/modules/${mod.id}`, {
      module: { position: finalPos }
    });
    console.log(`    ${mod.name} → final pos ${finalPos}`);
  }
  
  // Phase 3: Set prerequisites
  console.log('  Phase 3: Setting prerequisites...');
  for (let i = 1; i < orderedModules.length; i++) {
    const prevMod = orderedModules[i - 1];
    const currMod = orderedModules[i];
    await canvasApi('PUT', `/courses/${courseId}/modules/${currMod.id}`, {
      module: { prerequisite_module_ids: [prevMod.id] }
    });
    console.log(`    ${currMod.name} → requires → ${prevMod.name}`);
  }
  
  console.log(`  ✅ Done`);
}

async function main() {
  const courses = await getMyCourses();
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await fixCourse(course.id, course.course_code);
  }
  console.log('\n🎉 All courses fixed with two-phase positioning!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

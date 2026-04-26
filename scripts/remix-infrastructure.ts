import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const DOWNLOAD_PATH = path.join(os.homedir(), 'Downloads', 'UdemyCourses', 'courses');

const REMIX_MAP: Record<string, { target: string; priority: number; notes: string; status: 'keeper' | 'paid-missing' | 'cherry' | 'discard' }> = {
  'master-n8n-automations-in-2-hours': { target: 'ALABS-OPS-N8N', priority: 1, notes: 'Core n8n architecture intro', status: 'keeper' },
  'n8n-for-beginners-lead-generation-automation-ai-agents': { target: 'ALABS-OPS-N8N', priority: 1, notes: 'Business workflows + AI agents', status: 'keeper' },
  'build-ai-agents-with-n8n-free-hands-on-training': { target: 'ALABS-OPS-N8N', priority: 1, notes: 'OpenAI agent nodes', status: 'keeper' },
  'learn-rag-with-llmware-2024': { target: 'ALABS-OPS-RAG', priority: 1, notes: 'Local RAG architecture', status: 'keeper' },
  'master-github-copilot-from-basics-to-advanced-ai-coding': { target: 'ALABS-CORE-COPILOT', priority: 1, notes: 'Copilot deep dive', status: 'keeper' },
  'prompt-engineering-with-python-and-chatgpt-api-free-course': { target: 'ALABS-CORE-PROMPTS', priority: 2, notes: 'Python API patterns', status: 'keeper' },
  'chatgpt-prompt-engineering-free-course': { target: 'ALABS-CORE-PROMPTS', priority: 2, notes: 'Prompt patterns', status: 'keeper' },
  'free-prompt-engineering-masterclass-5-practical-examples': { target: 'ALABS-CORE-PROMPTS', priority: 2, notes: 'Practical prompt examples', status: 'keeper' },
  'machine-learning-fundamentals-python': { target: 'ALABS-AGENTS-ML', priority: 3, notes: 'ML foundations', status: 'keeper' },
  'machine-learning-with-python': { target: 'ALABS-AGENTS-ML', priority: 3, notes: 'Scikit-learn patterns', status: 'keeper' },
  'how-i-made-my-own-chatgpt-coder-that-codes-anything': { target: 'ALABS-AGENTS-AGENTS', priority: 3, notes: 'Code generation agent', status: 'keeper' },
  'build-custom-gpt-with-chatgpt-step-by-step-free-guide': { target: 'ALABS-AGENTS-AGENTS', priority: 3, notes: 'Tool-using AI', status: 'keeper' },
  'automate-data-analysis-with-ai-agents-and-n8n-no-code-power': { target: 'ALABS-OPS-N8N', priority: 3, notes: 'Data analysis + n8n', status: 'cherry' },
  'n8n-part-1-getting-started-with-n8n': { target: 'ALABS-OPS-N8N', priority: 3, notes: 'n8n basics primer', status: 'cherry' },
  'ai-agent-n8n-automation-masterclass-free-course-part-1': { target: 'ALABS-OPS-N8N', priority: 3, notes: 'Agent + automation masterclass', status: 'cherry' },
  'n8n-masterclass-learn-basic-ai-automation-using-n8n': { target: 'ALABS-OPS-N8N', priority: 3, notes: 'Basic AI & automation with n8n', status: 'cherry' },
};

interface Lecture {
  id: number;
  title: string;
  type?: string;
  index: number;
  status?: string;
  error?: string;
}

interface Chapter {
  id: number;
  title: string;
  index: number;
  lectures: Lecture[];
}

interface CourseMetadata {
  id: number;
  title: string;
  status: string;
  downloadDate: string;
  chapters: Chapter[];
}

async function scanCourses(): Promise<{ metadata: CourseMetadata; slug: string; path: string }[]> {
  const entries = await fs.readdir(DOWNLOAD_PATH, { withFileTypes: true });
  const courses: { metadata: CourseMetadata; slug: string; path: string }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(DOWNLOAD_PATH, entry.name, 'metadata.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf-8');
      const metadata: CourseMetadata = JSON.parse(raw);
      courses.push({ metadata, slug: entry.name, path: path.join(DOWNLOAD_PATH, entry.name) });
    } catch {}
  }
  return courses;
}

function matchSlugToTarget(slug: string): { target: string; priority: number; notes: string; status: string } | null {
  const normalized = slug.replace(/^\d+-/, '');
  for (const [key, value] of Object.entries(REMIX_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return value;
  }
  return null;
}

function isSkipLecture(title: string): boolean {
  const lower = title.toLowerCase();
  return [
    'intro', 'welcome', 'conclusion', 'wrap up', 'bonus', 'about the instructor',
    'my other courses', 'course overview', 'what you will learn', 'thank you',
    'download the', 'join the students', 'certificate', 'congratulations'
  ].some(k => lower.includes(k));
}

function getLecturesFromCourse(course: { metadata: CourseMetadata; path: string }): { title: string; chapter: string; hasFile: boolean; type?: string; status?: string }[] {
  const lectures: { title: string; chapter: string; hasFile: boolean; type?: string; status?: string }[] = [];
  
  // First try metadata chapters
  for (const ch of course.metadata.chapters) {
    for (const lec of ch.lectures) {
      if (isSkipLecture(lec.title)) continue;
      lectures.push({ title: lec.title, chapter: ch.title, hasFile: lec.status !== 'skipped', type: lec.type, status: lec.status });
    }
  }
  
  // If metadata lectures are empty, scan disk files
  if (lectures.length === 0) {
    const chaptersDir = path.join(course.path, 'chapters');
    try {
      const chapters = fs.readdirSync(chaptersDir);
      for (const ch of chapters) {
        const chPath = path.join(chaptersDir, ch);
        const stat = fs.statSync(chPath);
        if (!stat.isDirectory()) continue;
        const files = fs.readdirSync(chPath);
        for (const file of files) {
          if (!file.endsWith('.html') && !file.endsWith('.mp4') && !file.endsWith('.pdf')) continue;
          const title = file.replace(/\.\w+$/, '').replace(/^\d+-/, '').replace(/-/g, ' ');
          if (isSkipLecture(title)) continue;
          lectures.push({ title, chapter: ch.replace(/^\d+-/, '').replace(/-/g, ' '), hasFile: true });
        }
      }
    } catch {}
  }
  
  return lectures;
}

const REMIX_TEMPLATES: Record<string, { title: string; tier: string; modules: { name: string; isBridge: boolean; bridgeTemplate?: string }[] }> = {
  'ALABS-OPS-N8N': {
    title: 'Orchestrate Agents & Automations with n8n',
    tier: 'OPS',
    modules: [
      { name: 'The Problem: Why n8n Over SaaS Automation', isBridge: true, bridgeTemplate: 'Compare Zapier pricing/lock-in vs self-hosted n8n. Introduce owning your automation infrastructure.' },
      { name: 'n8n Architecture', isBridge: false },
      { name: 'Business Workflow Patterns', isBridge: false },
      { name: 'OpenAI Agent Nodes', isBridge: false },
      { name: 'n8n as Connector Layer', isBridge: true, bridgeTemplate: 'Show HTTP Request nodes and webhooks connecting n8n to Claude, ChatGPT, and Allternit APIs. n8n as integration layer.' },
      { name: 'Self-Hosting & Scaling', isBridge: true, bridgeTemplate: 'Docker deployment, env vars, unlimited executions. Exposing n8n workflows as MCP tools.' },
      { name: 'Bridge: How Allternit Uses n8n', isBridge: true, bridgeTemplate: 'How workflow-engine delegates orchestration to n8n while retaining state in its own runtime.' },
      { name: 'Capstone: Build a Self-Hosted n8n MCP Workflow', isBridge: true, bridgeTemplate: 'Project brief: Slack → LLM classification → Route to Notion or Allternit webhook. Exposed as MCP tool.' },
    ],
  },
  'ALABS-CORE-COPILOT': {
    title: 'Build AI-Assisted Software with Copilot & Cursor',
    tier: 'CORE',
    modules: [
      { name: 'The Problem: Manual Coding is the Bottleneck', isBridge: true, bridgeTemplate: 'Why compilers are fast but humans are slow. AI assistants as infrastructure.' },
      { name: 'Copilot as Infrastructure', isBridge: false },
      { name: 'Cursor Workflows', isBridge: false },
      { name: 'Prompting for Clean Code', isBridge: false },
      { name: 'Extending Assistants with Tools', isBridge: false },
      { name: 'Bridge: Allternit\'s Cursor + Copilot Stack', isBridge: true, bridgeTemplate: 'How mcp-apps-adapter and agui-gateway are maintained using Cursor and Copilot.' },
      { name: 'Capstone: Build an MCP Server with Cursor', isBridge: true, bridgeTemplate: 'Project brief: TypeScript MCP server built entirely via natural-language prompts in Cursor.' },
    ],
  },
  'ALABS-OPS-RAG': {
    title: 'Build Private RAG & Document Intelligence',
    tier: 'OPS',
    modules: [
      { name: 'The Problem: Cloud RAG Leaks Data', isBridge: true, bridgeTemplate: 'Privacy risks of cloud RAG. Why local-first matters for enterprise documents.' },
      { name: 'RAG Architecture', isBridge: false },
      { name: 'Local LLM Inference', isBridge: false },
      { name: 'Semantic Search Implementation', isBridge: false },
      { name: 'Agentic RAG', isBridge: true, bridgeTemplate: 'Retrieval as a tool call. Multi-step RAG vs naive single-pass RAG.' },
      { name: 'Bridge: Allternit\'s mcp-apps-adapter RAG', isBridge: true, bridgeTemplate: 'How Allternit uses local RAG to answer internal docs without third-party APIs.' },
      { name: 'Capstone: Offline Document-QA Agent', isBridge: true, bridgeTemplate: 'Project brief: Ingest PDFs, answer with citations, run offline on laptop.' },
    ],
  },
  'ALABS-CORE-PROMPTS': {
    title: 'Engineer Prompts for Agent Systems',
    tier: 'CORE',
    modules: [
      { name: 'The Problem: Guesswork vs. Systematic Prompt Engineering', isBridge: true, bridgeTemplate: 'Why most prompt engineering is guesswork and how to make it systematic.' },
      { name: 'The Prompt Engineering Stack', isBridge: false },
      { name: 'Python + OpenAI API Patterns', isBridge: false },
      { name: 'System Prompt Design', isBridge: false },
      { name: 'Developer Prompt Patterns', isBridge: false },
      { name: 'Bridge: Allternit\'s agui-gateway Prompt Tiers', isBridge: true, bridgeTemplate: 'How agui-gateway uses tiered system prompts to stay coherent across long sessions.' },
      { name: 'Capstone: Design a 3-Prompt Suite + Red-Team Report', isBridge: true, bridgeTemplate: 'Design a 3-prompt suite for a support agent and red-team it.' },
    ],
  },
  'ALABS-OPS-VISION': {
    title: 'Computer Vision for AI Systems',
    tier: 'OPS',
    modules: [
      { name: 'The Problem: LLMs Are Blind', isBridge: true, bridgeTemplate: 'LLMs need vision to interact with real-world interfaces.' },
      { name: 'OpenCV + Python Foundations', isBridge: false },
      { name: 'Feature Detection & Tracking', isBridge: false },
      { name: 'Face & Object Detection with Deep Learning', isBridge: false },
      { name: 'Bridge: Connecting OpenCV to Agent Systems', isBridge: true, bridgeTemplate: 'How computer-use SDK captures screen regions and feeds them to LLM agents.' },
      { name: 'Capstone: Build a Screen-State Analyzer for LLM Agents', isBridge: true, bridgeTemplate: 'Build a screen-state analyzer that feeds visual context to an LLM agent.' },
    ],
  },
  'ALABS-AGENTS-ML': {
    title: 'ML as Agent Tools',
    tier: 'AGENTS',
    modules: [
      { name: 'The Problem: Agents Are Bad at Structured Data Math', isBridge: true, bridgeTemplate: 'Agents are great at language but terrible at structured-data math. ML fills the gap.' },
      { name: 'When to Use ML vs. LLMs vs. Rules', isBridge: false },
      { name: 'Scikit-Learn Patterns', isBridge: false },
      { name: 'Feature Engineering for Structured Data', isBridge: false },
      { name: 'Bridge: Wrapping ML Models as MCP Tools', isBridge: true, bridgeTemplate: 'How Allternit wraps ML models as MCP tools so agui-gateway can delegate numerical reasoning.' },
      { name: 'Capstone: Wrap a Scikit-Learn Model as an MCP Tool', isBridge: true, bridgeTemplate: 'Build an agent that selects, trains, and exposes an ML model as an MCP tool.' },
    ],
  },
  'ALABS-AGENTS-AGENTS': {
    title: 'Architect Multi-Agent Systems',
    tier: 'AGENTS',
    modules: [
      { name: 'The Problem: One LLM Can\'t Do Everything', isBridge: true, bridgeTemplate: 'One LLM cant do everything well. Specialization requires orchestration.' },
      { name: 'Agent Architecture Patterns', isBridge: false },
      { name: 'Tool-Using Agents', isBridge: false },
      { name: 'Code-Generation Agents', isBridge: false },
      { name: 'Multi-Agent Orchestration', isBridge: false },
      { name: 'Bridge: Allternit\'s Agent Swarm Communication', isBridge: true, bridgeTemplate: 'How Allternit uses communication domain services and mcp-apps-adapter for agent collaboration.' },
      { name: 'Capstone: Design a 3-Agent Collaborative Blog-Writing System', isBridge: true, bridgeTemplate: 'Design a 3-agent system that collaboratively writes a technical blog post.' },
    ],
  },
};

async function generateRemixPlan(targetCode: string) {
  const template = REMIX_TEMPLATES[targetCode];
  if (!template) return null;
  
  const allCourses = await scanCourses();
  const matched = allCourses
    .map(c => ({ ...c, match: matchSlugToTarget(c.slug) }))
    .filter(c => c.match?.target === targetCode && (c.match.status === 'keeper' || c.match.status === 'cherry'))
    .sort((a, b) => (a.match!.priority - b.match!.priority));
  
  const plan = {
    courseCode: targetCode,
    courseTitle: template.title,
    tier: template.tier,
    sources: matched.map(m => ({
      id: m.metadata.id,
      title: m.metadata.title,
      slug: m.slug,
      totalLectures: m.metadata.chapters.reduce((a, ch) => a + ch.lectures.length, 0),
    })),
    modules: template.modules.map(mod => ({
      name: mod.name,
      sourceLectures: [] as any[],
      bridgeContent: mod.isBridge ? (mod.bridgeTemplate || '') : undefined,
      isBridge: mod.isBridge,
    })),
  };
  
  const nonBridgeIndices = plan.modules.map((m, i) => m.isBridge ? -1 : i).filter(i => i >= 0);
  if (nonBridgeIndices.length === 0) nonBridgeIndices.push(0);
  
  let roundRobinIdx = 0;
  for (const m of matched) {
    const lectures = getLecturesFromCourse(m);
    for (const lec of lectures) {
      const modIdx = nonBridgeIndices[roundRobinIdx % nonBridgeIndices.length];
      plan.modules[modIdx].sourceLectures.push({
        course: m.metadata.title,
        chapter: lec.chapter,
        lecture: lec.title,
        hasFile: lec.hasFile,
      });
      roundRobinIdx++;
    }
  }
  
  return plan;
}

async function writeRemixPlan(plan: any) {
  const outDir = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-plans');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${plan.courseCode}.json`);
  await fs.writeFile(outPath, JSON.stringify(plan, null, 2));
  console.log(`Wrote remix plan: ${outPath}`);
}

async function generateBridgeModuleFiles(plan: any) {
  const outDir = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'remix-content', plan.courseCode);
  await fs.mkdir(outDir, { recursive: true });
  
  for (let i = 0; i < plan.modules.length; i++) {
    const mod = plan.modules[i];
    if (!mod.isBridge || !mod.bridgeContent) continue;
    
    const fileName = `module-${String(i + 1).padStart(2, '0')}-${mod.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    const filePath = path.join(outDir, fileName);
    
    try {
      const existing = await fs.readFile(filePath, 'utf-8');
      if (existing.length > 400 && !existing.includes('Objective 1')) {
        continue;
      }
    } catch {}
    
    const content = `# ${mod.name}\n\n**Course:** ${plan.courseCode} — ${plan.courseTitle}\n**Tier:** ${plan.tier}\n\n## Bridge Concept\n${mod.bridgeContent}\n\n## Learning Objectives\n- [ ] Objective 1\n- [ ] Objective 2\n- [ ] Objective 3\n\n## Demo Outline (10 min)\n1. Step one\n2. Step two\n3. Step three\n\n## Challenge (5 min)\n> TODO: Define the bounded learner task here.\n\n## Allternit Connection\n- Internal system: \n- Reference repo/file: \n- Key difference from standard approach: \n`;
    await fs.writeFile(filePath, content);
    console.log(`  Wrote bridge module: ${fileName}`);
  }
}

async function main() {
  const targets = process.argv.slice(2);
  const codes = targets.length > 0 ? targets : Object.keys(REMIX_TEMPLATES);
  
  for (const code of codes) {
    console.log(`\n--- Generating ${code} ---`);
    const plan = await generateRemixPlan(code);
    if (!plan) {
      console.log(`No template found for ${code}`);
      continue;
    }
    await writeRemixPlan(plan);
    await generateBridgeModuleFiles(plan);
    
    const totalLectures = plan.modules.reduce((a: number, m: any) => a + m.sourceLectures.length, 0);
    console.log(`Sources: ${plan.sources.length} (${totalLectures} total mapped lectures)`);
    console.log(`Modules: ${plan.modules.length}`);
    for (const mod of plan.modules) {
      const label = mod.isBridge ? '[BRIDGE]' : '[SOURCE]';
      console.log(`  ${label} ${mod.name} (${mod.sourceLectures.length} lectures)`);
    }
  }
}

main().catch(console.error);

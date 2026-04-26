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

const CURRICULUM_HTML = `
<div style="max-width: 800px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
  <h1 style="color: #1e293b;">A://Labs Curriculum Map</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">
    A://Labs is organized into three tiers: <strong>CORE</strong>, <strong>OPS</strong>, and <strong>AGENTS</strong>.
    You can take courses within a tier in any order, but we recommend starting with CORE courses if you are new to building AI systems.
  </p>
  
  <div style="margin: 32px 0;">
    <div style="background: #4f46e5; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">CORE Tier — Foundation Skills</div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-CORE-COPILOT — Build AI-Assisted Software</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Cursor, Copilot, and vibe-coding infrastructure. You will ship a TypeScript MCP server.</div>
      </div>
      <div style="padding: 16px 20px;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-CORE-PROMPTS — Engineer Prompts for Agent Systems</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Systematic prompt engineering, API patterns, and red-teaming. You will design a production prompt suite.</div>
      </div>
    </div>
  </div>
  
  <div style="margin: 32px 0;">
    <div style="background: #059669; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">OPS Tier — Infrastructure & Operations</div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-OPS-N8N — Orchestrate Agents & Automations</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Self-hosted n8n workflows, AI agent nodes, and MCP exposure.</div>
      </div>
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-OPS-RAG — Private RAG & Document Intelligence</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Local-first retrieval, semantic search, and offline document QA.</div>
      </div>
      <div style="padding: 16px 20px;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-OPS-VISION — Computer Vision for AI Systems</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">OpenCV, feature detection, and screen-state analysis for LLM agents.</div>
      </div>
    </div>
  </div>
  
  <div style="margin: 32px 0;">
    <div style="background: #dc2626; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">AGENTS Tier — Advanced Systems</div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-AGENTS-ML — ML as Agent Tools</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">When to use ML vs. LLMs, scikit-learn patterns, and wrapping models as MCP tools.</div>
      </div>
      <div style="padding: 16px 20px;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-AGENTS-AGENTS — Architect Multi-Agent Systems</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">ReAct loops, tool use, code-generation agents, and multi-agent orchestration.</div>
      </div>
    </div>
  </div>
  
  <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 24px;">
    <h3 style="margin-top: 0; color: #1e293b;">Recommended Paths</h3>
    <ul style="color: #475569; line-height: 1.8; margin-bottom: 0;">
      <li><strong>New to AI engineering:</strong> Start with CORE → pick one OPS course → finish with AGENTS.</li>
      <li><strong>Building automation:</strong> ALABS-OPS-N8N → ALABS-OPS-RAG → ALABS-AGENTS-AGENTS.</li>
      <li><strong>Building products:</strong> ALABS-CORE-COPILOT → ALABS-CORE-PROMPTS → ALABS-AGENTS-AGENTS.</li>
    </ul>
  </div>
</div>
`.trim();

async function addCurriculumMap(courseId: number, courseCode: string) {
  console.log(`\n--- Adding curriculum map to ${courseCode} ---`);
  
  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  const existing = pages.find(p => p.title === 'A://Labs Curriculum Map');
  
  if (existing) {
    console.log(`  ⏭️ Curriculum map already exists`);
    return;
  }
  
  const page = await canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: {
      title: 'A://Labs Curriculum Map',
      body: CURRICULUM_HTML,
      published: true,
    }
  }) as any;
  
  console.log(`  ✅ Created curriculum map page: ${page.url}`);
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Adding curriculum map to ${courses.length} courses...`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await addCurriculumMap(course.id, course.course_code);
  }
  
  console.log('\n✅ Curriculum maps added to all courses!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

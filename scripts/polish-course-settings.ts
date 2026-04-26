const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const PUBLIC_DESCS: Record<string, string> = {
  'ALABS-CORE-COPILOT': 'Build AI-assisted software with Copilot and Cursor. A project-first CORE course where you ship a TypeScript MCP server built through natural-language prompts.',
  'ALABS-CORE-PROMPTS': 'Master systematic prompt engineering for production agent systems. Design, test, and red-team a complete prompt suite.',
  'ALABS-OPS-N8N': 'Build self-hosted automation infrastructure with n8n. Deploy workflows that connect APIs, AI agents, and internal systems without vendor lock-in.',
  'ALABS-OPS-VISION': 'Give your agents eyes. Learn OpenCV and computer vision patterns that feed structured visual context to LLM agents.',
  'ALABS-OPS-RAG': 'Build private, local-first document intelligence. Construct a fully offline RAG pipeline with zero cloud data leaks.',
  'ALABS-AGENTS-ML': 'Make your agents good at math. Wrap scikit-learn models as MCP tools so LLM agents can delegate structured-data reasoning.',
  'ALABS-AGENTS-AGENTS': 'Architect multi-agent systems where specialized agents collaborate. Design a 3-agent swarm that researches, outlines, and writes together.',
};

const TABS_CONFIG: Record<string, boolean> = {
  home: true,
  announcements: false,
  assignments: true,
  discussions: false,
  grades: true,
  people: false,
  pages: true,
  files: false,
  syllabus: true,
  outcomes: false,
  quizzes: false,
  modules: true,
  settings: false,
  collaborations: false,
  conferences: false,
};

async function canvasApi(method: string, pathStr: string, body?: any, expectError = false) {
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
  if (!resp.ok && resp.status !== 204 && !expectError) {
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

async function polishCourse(courseId: number, courseCode: string) {
  console.log(`\n--- Polishing ${courseCode} ---`);
  
  await canvasApi('PUT', `/courses/${courseId}`, {
    course: {
      public_description: PUBLIC_DESCS[courseCode],
      is_public: false,
      is_public_to_auth_users: true,
      public_syllabus: false,
    }
  });
  console.log(`  ✅ Public description updated`);
  
  const tabs = await canvasApi('GET', `/courses/${courseId}/tabs`) as any[];
  for (const tab of tabs) {
    const tabId = tab.id;
    if (!tab.label) continue;
    
    const shouldShow = TABS_CONFIG[tabId] ?? (tab.visibility === 'public');
    const currentHidden = tab.hidden === true;
    
    if (currentHidden === !shouldShow) continue;
    
    const result = await canvasApi('PUT', `/courses/${courseId}/tabs/${tabId}`, {
      tab: { hidden: !shouldShow }
    }, true);
    
    if (result && (result as any).error) {
      console.log(`  ⚠️ Skipped ${tab.label}: ${(result as any).error}`);
    } else {
      console.log(`  ${shouldShow ? '✅ Shown' : '❌ Hidden'}: ${tab.label}`);
    }
  }
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Polishing ${courses.length} courses...\n`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await polishCourse(course.id, course.course_code);
  }
  
  console.log('\n✅ Course settings polished!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const WELCOME_POSTS: Record<string, { title: string; message: string }> = {
  'ALABS-CORE-COPILOT': {
    title: 'Welcome to A://Labs — Build AI-Assisted Software',
    message: `<p>Welcome to <strong>ALABS-CORE-COPILOT</strong>.</p>
<p>This course is designed to be dense and project-first. You will move fast through Copilot and Cursor workflows, but the real test is the capstone: building a TypeScript MCP server using mostly natural-language prompts.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Complete modules in order. Each module unlocks after the previous one.</li>
<li>Do the module challenges. They are short (5–10 min) and build the skills you need for the capstone.</li>
<li>Don't skip the bridge modules. That is where we connect universal tools to the Allternit stack.</li>
</ul>
<p>If you get stuck, review the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> to see how this course fits into the broader A://Labs path.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
  'ALABS-CORE-PROMPTS': {
    title: 'Welcome to A://Labs — Engineer Prompts for Agent Systems',
    message: `<p>Welcome to <strong>ALABS-CORE-PROMPTS</strong>.</p>
<p>Prompt engineering is not magic. This course teaches you to treat prompts as interfaces: designed, tested, and versioned. By the end, you will have a red-teamed prompt suite ready for production.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Work through the modules sequentially.</li>
<li>Complete the short challenges at the end of each module.</li>
<li>Pay special attention to the Bridge modules — they show how agui-gateway handles prompt tiers in production.</li>
</ul>
<p>See the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> for recommended learning paths.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
  'ALABS-OPS-N8N': {
    title: 'Welcome to A://Labs — Orchestrate Agents & Automations',
    message: `<p>Welcome to <strong>ALABS-OPS-N8N</strong>.</p>
<p>This course is about owning your automation infrastructure. We will compare SaaS automation lock-in against self-hosted n8n, then build real workflows including AI agent nodes and MCP tool exposure.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Modules must be completed in order.</li>
<li>The early modules cover architecture and patterns. The later bridge modules connect everything to Allternit's internal stack.</li>
<li>The capstone requires a working self-hosted n8n instance. Start thinking about where you will run it.</li>
</ul>
<p>Check the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> to see where this fits.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
  'ALABS-OPS-VISION': {
    title: 'Welcome to A://Labs — Computer Vision for AI Systems',
    message: `<p>Welcome to <strong>ALABS-OPS-VISION</strong>.</p>
<p>LLMs cannot see. This course teaches you to bridge computer vision (OpenCV, feature detection, object detection) into agent systems so your agents can interact with real-world interfaces.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Work through modules sequentially.</li>
<li>The source modules draw from OpenCV documentation and free tutorials. The bridge modules show how Allternit applies these techniques to screen-state analysis.</li>
<li>The capstone asks you to build a working screen-state analyzer.</li>
</ul>
<p>See the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> for context.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
  'ALABS-OPS-RAG': {
    title: 'Welcome to A://Labs — Private RAG & Document Intelligence',
    message: `<p>Welcome to <strong>ALABS-OPS-RAG</strong>.</p>
<p>This course teaches you to build retrieval-augmented generation systems that run entirely on your own hardware. No cloud API calls for embeddings or generation. Zero data leakage.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Complete modules in order.</li>
<li>You will need a machine capable of running local LLMs (Ollama or similar). A modern laptop with 16GB RAM is sufficient.</li>
<li>The capstone is a zero-network test. That means you will literally turn off Wi-Fi and prove your pipeline works.</li>
</ul>
<p>Review the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> to plan your path.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
  'ALABS-AGENTS-ML': {
    title: 'Welcome to A://Labs — ML as Agent Tools',
    message: `<p>Welcome to <strong>ALABS-AGENTS-ML</strong>.</p>
<p>Agents are great at language and terrible at math. This course fills the gap by teaching you when to delegate structured-data tasks to scikit-learn models and how to wrap those models as agent-callable MCP tools.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Work through modules sequentially.</li>
<li>The challenges are hands-on: you will train models, build pipelines, and expose them as tools.</li>
<li>The bridge modules connect everything to how Allternit uses ML inside mcp-apps-adapter.</li>
</ul>
<p>See the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> for recommended sequencing.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
  'ALABS-AGENTS-AGENTS': {
    title: 'Welcome to A://Labs — Architect Multi-Agent Systems',
    message: `<p>Welcome to <strong>ALABS-AGENTS-AGENTS</strong>.</p>
<p>One LLM cannot do everything well. This course teaches you to design systems of specialized agents that collaborate through structured handoffs. You will implement ReAct loops, tool use, code generation, and multi-agent orchestration.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>We recommend completing ALABS-CORE-PROMPTS first if you have not already.</li>
<li>Modules must be completed in order.</li>
<li>The capstone is substantial: a 3-agent collaborative blog-writing system. Start planning early.</li>
</ul>
<p>Check the <a href="/courses/__COURSE_ID__/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> to see the full A://Labs path.</p>
<p>Good luck.<br>— A://Labs</p>`,
  },
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

async function addWelcomeAnnouncement(courseId: number, courseCode: string) {
  console.log(`\n--- Adding welcome announcement to ${courseCode} ---`);
  const post = WELCOME_POSTS[courseCode];
  if (!post) {
    console.log(`  ⚠️ No welcome post defined`);
    return;
  }
  
  // Check if welcome announcement already exists
  const announcements = await canvasApi('GET', `/courses/${courseId}/discussion_topics?only_announcements=true&per_page=100`) as any[];
  const existing = announcements.find(a => a.title === post.title);
  if (existing) {
    console.log(`  ⏭️ Welcome announcement already exists`);
    return;
  }
  
  const message = post.message.replace(/__COURSE_ID__/g, String(courseId));
  
  await canvasApi('POST', `/courses/${courseId}/discussion_topics`, {
    title: post.title,
    message,
    is_announcement: true,
    published: true,
  });
  
  console.log(`  ✅ Welcome announcement posted`);
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Adding welcome announcements to ${courses.length} courses...\n`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await addWelcomeAnnouncement(course.id, course.course_code);
  }
  
  console.log('\n✅ Welcome announcements added!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

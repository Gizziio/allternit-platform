const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const SYLLABI: Record<string, string> = {
  'ALABS-CORE-COPILOT': `
<h1>Course Syllabus: Build AI-Assisted Software</h1>
<p><strong>Course Code:</strong> ALABS-CORE-COPILOT<br><strong>Tier:</strong> CORE<br><strong>Estimated Time:</strong> 4–5 hours<br><strong>Prerequisites:</strong> Basic TypeScript familiarity</p>
<h2>Course Description</h2>
<p>This course teaches you to use AI coding assistants as infrastructure, not toys. You will learn GitHub Copilot for in-flight suggestions, Cursor for architectural refactoring, and how to prompt for clean, maintainable code. The capstone project asks you to build a TypeScript MCP server using primarily natural-language prompts in Cursor.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Use Copilot context commands effectively for repo-wide reasoning</li>
<li>Refactor across multiple files using Cursor Composer</li>
<li>Prompt for typed, tested, and documented code</li>
<li>Extend assistants with custom tools and MCP servers</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each) designed to build muscle memory.</p>
<h2>Policies</h2>
<p>All work must be your own. AI assistance is encouraged, but you must understand and be able to explain every line of code you submit.</p>
`,
  'ALABS-CORE-PROMPTS': `
<h1>Course Syllabus: Engineer Prompts for Agent Systems</h1>
<p><strong>Course Code:</strong> ALABS-CORE-PROMPTS<br><strong>Tier:</strong> CORE<br><strong>Estimated Time:</strong> 3–4 hours<br><strong>Prerequisites:</strong> Basic Python familiarity</p>
<h2>Course Description</h2>
<p>This course replaces prompt-engineering guesswork with a systematic framework. You will learn the four-layer Prompt Engineering Stack, implement Python + OpenAI API patterns, design bulletproof system prompts, and apply developer-specific prompt patterns. The capstone asks you to design a 3-prompt suite and red-team it.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Design prompts as versioned interfaces rather than chat messages</li>
<li>Build structured API clients with conversation memory</li>
<li>Write system prompts that resist drift and injection attacks</li>
<li>Evaluate prompt quality with test suites and adversarial inputs</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each).</p>
<h2>Policies</h2>
<p>All work must be your own. You may use AI assistants to draft prompts, but the final architecture and test suite must reflect your own design decisions.</p>
`,
  'ALABS-OPS-N8N': `
<h1>Course Syllabus: Orchestrate Agents & Automations</h1>
<p><strong>Course Code:</strong> ALABS-OPS-N8N<br><strong>Tier:</strong> OPS<br><strong>Estimated Time:</strong> 5–6 hours<br><strong>Prerequisites:</strong> Basic HTTP/API familiarity</p>
<h2>Course Description</h2>
<p>This course makes the case for self-hosted automation infrastructure using n8n. You will learn n8n architecture, business workflow patterns, OpenAI agent nodes, and how to expose workflows as MCP tools. The capstone asks you to deploy a self-hosted n8n workflow and document it as an MCP tool.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Compare SaaS automation TCO vs. self-hosted n8n</li>
<li>Build trigger-based workflows with HTTP, LLM, and webhook nodes</li>
<li>Deploy n8n with Docker and PostgreSQL</li>
<li>Design workflows that can be consumed by external agents</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each).</p>
<h2>Policies</h2>
<p>All work must be your own. You may use AI assistants for code generation, but you must be able to explain the data flow and security boundaries of every workflow you submit.</p>
`,
  'ALABS-OPS-VISION': `
<h1>Course Syllabus: Computer Vision for AI Systems</h1>
<p><strong>Course Code:</strong> ALABS-OPS-VISION<br><strong>Tier:</strong> OPS<br><strong>Estimated Time:</strong> 4–5 hours<br><strong>Prerequisites:</strong> Basic Python familiarity</p>
<h2>Course Description</h2>
<p>LLMs are blind. This course teaches you to give them vision using OpenCV and deep learning detectors. You will learn image preprocessing, feature detection, and how to connect classical computer vision to modern agent systems. The capstone asks you to build a screen-state analyzer that feeds visual context to an LLM agent.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Process images and video with OpenCV in Python</li>
<li>Detect features, track objects, and run local deep-learning detectors</li>
<li>Extract structured UI state from screenshots</li>
<li>Feed visual context to LLM agents without sending raw images to the cloud</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each).</p>
<h2>Policies</h2>
<p>All work must be your own. You may use AI assistants for code generation, but you must understand the vision pipeline you build.</p>
`,
  'ALABS-OPS-RAG': `
<h1>Course Syllabus: Private RAG & Document Intelligence</h1>
<p><strong>Course Code:</strong> ALABS-OPS-RAG<br><strong>Tier:</strong> OPS<br><strong>Estimated Time:</strong> 3–4 hours<br><strong>Prerequisites:</strong> Basic Python familiarity</p>
<h2>Course Description</h2>
<p>This course teaches you to build retrieval-augmented generation systems that run entirely offline. You will learn RAG architecture, local LLM inference with Ollama, semantic search with vector stores, and agentic multi-step retrieval. The capstone asks you to build a document-QA agent that survives a zero-network test.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Quantify the privacy and cost trade-offs of local vs. cloud RAG</li>
<li>Build a complete ingestion → embedding → retrieval → generation pipeline</li>
<li>Run local LLMs via OpenAI-compatible APIs</li>
<li>Implement agentic RAG loops with citation tracking</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each).</p>
<h2>Policies</h2>
<p>All work must be your own. You may use AI assistants for code generation, but you must be able to explain your chunking, embedding, and retrieval strategy.</p>
`,
  'ALABS-AGENTS-ML': `
<h1>Course Syllabus: ML as Agent Tools</h1>
<p><strong>Course Code:</strong> ALABS-AGENTS-ML<br><strong>Tier:</strong> AGENTS<br><strong>Estimated Time:</strong> 4–5 hours<br><strong>Prerequisites:</strong> Basic Python familiarity</p>
<h2>Course Description</h2>
<p>LLMs are terrible at structured-data math. This course teaches you when to delegate numerical reasoning to scikit-learn models and how to expose those models as agent-callable tools. You will learn the rules-vs-ML-vs-LLM decision framework, scikit-learn pipelines, and the MCP tool wrapping pattern. The capstone asks you to train and expose a model as an MCP tool.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Select rules, ML, or LLMs based on data and constraints</li>
<li>Build reproducible scikit-learn pipelines</li>
<li>Engineer features for tabular data</li>
<li>Wrap models as typed, versioned MCP tools</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each).</p>
<h2>Policies</h2>
<p>All work must be your own. You may use AI assistants for code generation, but you must understand your model's feature schema and validation logic.</p>
`,
  'ALABS-AGENTS-AGENTS': `
<h1>Course Syllabus: Architect Multi-Agent Systems</h1>
<p><strong>Course Code:</strong> ALABS-AGENTS-AGENTS<br><strong>Tier:</strong> AGENTS<br><strong>Estimated Time:</strong> 4–5 hours<br><strong>Prerequisites:</strong> ALABS-CORE-PROMPTS recommended</p>
<h2>Course Description</h2>
<p>One LLM cannot do everything well. This course teaches you to design multi-agent systems where specialized agents collaborate through structured handoffs. You will learn ReAct architecture, tool-using agents, code-generation agents, and event-driven orchestration. The capstone asks you to design a 3-agent blog-writing swarm.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Implement ReAct loops with structured tool schemas</li>
<li>Design tool registries using the Model Context Protocol</li>
<li>Build self-correcting code-generation pipelines</li>
<li>Orchestrate multiple agents with clear contracts and fault tolerance</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points). Module challenges are ungraded practice assignments (10 points each).</p>
<h2>Policies</h2>
<p>All work must be your own. You may use AI assistants for code generation, but you must be able to explain the communication contract between every agent in your system.</p>
`,
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

async function updateSyllabus(courseId: number, courseCode: string) {
  console.log(`\n--- Updating syllabus for ${courseCode} ---`);
  const html = SYLLABI[courseCode];
  if (!html) {
    console.log(`  ⚠️ No syllabus found`);
    return;
  }
  
  await canvasApi('PUT', `/courses/${courseId}`, {
    course: { syllabus_body: html }
  });
  console.log(`  ✅ Syllabus updated`);
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Adding syllabi to ${courses.length} courses...\n`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await updateSyllabus(course.id, course.course_code);
  }
  
  console.log('\n✅ Syllabi added to all courses!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import fs from 'fs/promises';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

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

async function getMyCourses(): Promise<{ id: number; course_code: string; name: string }[]> {
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
    .map(c => ({ id: c.id, course_code: c.course_code, name: c.name }));
}

async function createPage(courseId: number, title: string, bodyHtml: string) {
  return await canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: { title, body: bodyHtml, published: true }
  }) as any;
}

async function setFrontPage(courseId: number, pageUrl: string) {
  // Update the wiki page to be the front page
  await canvasApi('PUT', `/courses/${courseId}/pages/${pageUrl}`, {
    wiki_page: { front_page: true }
  });
  // Try to update course to use wiki front page as home
  try {
    await canvasApi('PUT', `/courses/${courseId}`, {
      course: { default_view: 'wiki_page' }
    });
    return 'wiki_page';
  } catch {
    // Fallback to modules view if wiki_page is not allowed
    try {
      await canvasApi('PUT', `/courses/${courseId}`, {
        course: { default_view: 'modules' }
      });
      return 'modules';
    } catch {
      return 'unchanged';
    }
  }
}

function generateHomePageHtml(courseCode: string, courseName: string): string {
  const tier = courseCode.includes('CORE') ? 'CORE' : courseCode.includes('OPS') ? 'OPS' : 'AGENTS';
  const tierColor = tier === 'CORE' ? '#4f46e5' : tier === 'OPS' ? '#059669' : '#dc2626';
  
  const descriptions: Record<string, string> = {
    'ALABS-CORE-COPILOT': 'Learn to build AI-assisted software using GitHub Copilot and Cursor. By the end of this course, you will ship a working TypeScript MCP server built entirely through natural-language prompts.',
    'ALABS-CORE-PROMPTS': 'Master systematic prompt engineering for production agent systems. Design, test, and red-team a complete prompt suite that makes LLMs reliable and safe.',
    'ALABS-OPS-N8N': 'Build self-hosted automation infrastructure with n8n. Deploy workflows that connect APIs, AI agents, and internal systems—without vendor lock-in.',
    'ALABS-OPS-VISION': 'Give your agents eyes. Learn OpenCV and computer vision patterns that feed structured visual context to LLM agents for real-world interaction.',
    'ALABS-OPS-RAG': 'Build private, local-first document intelligence systems. Construct a fully offline RAG pipeline that answers questions from your documents with zero cloud data leaks.',
    'ALABS-AGENTS-ML': 'Make your agents good at math. Wrap scikit-learn models as MCP tools so LLM agents can delegate structured-data reasoning to specialist models.',
    'ALABS-AGENTS-AGENTS': 'Architect multi-agent systems where specialized agents collaborate. Design a 3-agent swarm that researches, outlines, and writes a technical blog post together.',
  };
  
  const prerequisites: Record<string, string> = {
    'ALABS-CORE-COPILOT': 'Basic TypeScript familiarity.',
    'ALABS-CORE-PROMPTS': 'Basic Python familiarity.',
    'ALABS-OPS-N8N': 'Basic HTTP/API familiarity.',
    'ALABS-OPS-VISION': 'Basic Python familiarity.',
    'ALABS-OPS-RAG': 'Basic Python familiarity.',
    'ALABS-AGENTS-ML': 'Basic Python familiarity.',
    'ALABS-AGENTS-AGENTS': 'ALABS-CORE-PROMPTS recommended.',
  };
  
  const timeEstimates: Record<string, string> = {
    'ALABS-CORE-COPILOT': '4–5 hours',
    'ALABS-CORE-PROMPTS': '3–4 hours',
    'ALABS-OPS-N8N': '5–6 hours',
    'ALABS-OPS-VISION': '4–5 hours',
    'ALABS-OPS-RAG': '3–4 hours',
    'ALABS-AGENTS-ML': '4–5 hours',
    'ALABS-AGENTS-AGENTS': '4–5 hours',
  };
  
  return `
<div style="max-width: 800px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
  <div style="background: ${tierColor}; color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px;">
    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-bottom: 8px;">${tier} TIER</div>
    <h1 style="margin: 0; font-size: 32px;">${courseName}</h1>
    <p style="margin: 16px 0 0 0; font-size: 18px; line-height: 1.5; opacity: 0.95;">${descriptions[courseCode]}</p>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
    <h2 style="margin-top: 0; color: #1e293b;">Course Structure</h2>
    <p style="color: #475569; line-height: 1.6;">
      Each module follows the A://Labs rhythm: <strong>Problem → Concept → Demo → Bridge → Challenge</strong>. 
      Modules build on each other sequentially. You must complete each module before the next unlocks.
    </p>
    <ul style="color: #475569; line-height: 1.8;">
      <li><strong>Bridge modules</strong> contain original A://Labs content that connects universal concepts to the Allternit stack.</li>
      <li><strong>Source modules</strong> provide structured learning paths drawn from curated courses and documentation.</li>
      <li><strong>Capstone project</strong> is the final module where you ship a real, working artifact.</li>
    </ul>
  </div>
  
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Estimated Time</div>
      <div style="font-size: 20px; font-weight: 600; color: #1e293b;">${timeEstimates[courseCode]}</div>
    </div>
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Prerequisites</div>
      <div style="font-size: 16px; font-weight: 500; color: #1e293b;">${prerequisites[courseCode]}</div>
    </div>
  </div>
  
  <div style="background: #fffbeb; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #fcd34d;">
    <h2 style="margin-top: 0; color: #92400e;">Assessment</h2>
    <p style="color: #78350f; margin: 0;">
      This course is assessed through a <strong>capstone project submission</strong>. There are no quizzes. 
      Your final project will be evaluated on correctness, documentation, and how well it demonstrates the course learning objectives.
    </p>
  </div>
  
  <div style="text-align: center; padding: 32px;">
    <a href="/courses/__COURSE_ID__/modules" style="display: inline-block; background: ${tierColor}; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Start Learning →</a>
  </div>
  
  <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px; color: #64748b; font-size: 14px;">
    <p><strong>A://Labs</strong> is the internal learning engine of Allternit. Courses are designed to be dense, project-first, and immediately applicable to the systems we build.</p>
  </div>
</div>
  `.trim();
}

async function setupHomePage(courseId: number, courseCode: string, courseName: string) {
  console.log(`\n--- Setting up homepage for ${courseCode} ---`);
  
  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  const frontPage = pages.find(p => p.front_page);
  
  if (frontPage) {
    console.log(`  ⏭️ Front page already exists: ${frontPage.title}`);
    // Try to ensure course uses a reasonable default view
    const course = await canvasApi('GET', `/courses/${courseId}`) as any;
    if (!course.default_view || course.default_view === 'feed') {
      await canvasApi('PUT', `/courses/${courseId}`, {
        course: { default_view: 'modules' }
      }).catch(() => {});
    }
    return;
  }
  
  const html = generateHomePageHtml(courseCode, courseName).replace(/__COURSE_ID__/g, String(courseId));
  const page = await createPage(courseId, 'Welcome to A://Labs', html);
  const viewMode = await setFrontPage(courseId, page.url);
  console.log(`  ✅ Homepage created (course view: ${viewMode})`);
}

async function main() {
  const courses = await getMyCourses();
  console.log('Found A://Labs courses:');
  for (const c of courses) {
    console.log(`  ${c.course_code}: ${c.id}`);
  }
  
  for (const c of courses) {
    await setupHomePage(c.id, c.course_code, c.name);
  }
  
  console.log('\n✅ Homepages setup complete!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

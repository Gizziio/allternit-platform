import { chromium } from 'playwright';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';

const COURSES = [
  {
    name: 'A://Labs — Build AI-Assisted Software',
    code: 'ALABS-CORE-COPILOT',
    description: 'A://Labs CORE Course — Build AI-Assisted Software. Dense, project-first course for engineers building AI systems. By the end, you will ship a working TypeScript MCP server built with Cursor and Copilot. Prerequisites: Basic TypeScript familiarity. Estimated time: 4–5 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: Manual Coding is the Bottleneck',
      'Copilot as Infrastructure',
      'Cursor Workflows',
      'Prompting for Clean Code',
      'Extending Assistants with Tools',
      'Bridge: Allternit\'s Cursor + Copilot Stack',
    ],
    capstone: 'Capstone Project: Build a TypeScript MCP Server with Cursor',
  },
  {
    name: 'A://Labs — Engineer Prompts for Agent Systems',
    code: 'ALABS-CORE-PROMPTS',
    description: 'A://Labs CORE Course — Engineer Prompts for Agent Systems. Dense, project-first course for engineers building LLM-powered features. By the end, you will design a system-prompt suite that makes an LLM agent reliable, safe, and useful in production. Prerequisites: Basic Python familiarity. Estimated time: 3–4 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: Guesswork vs. Systematic Prompt Engineering',
      'The Prompt Engineering Stack',
      'Python + OpenAI API Patterns',
      'System Prompt Design',
      'Developer Prompt Patterns',
      'Bridge: Allternit\'s agui-gateway Prompt Tiers',
    ],
    capstone: 'Capstone Project: Design a 3-Prompt Suite + Red-Team Report',
  },
  {
    name: 'A://Labs — Orchestrate Agents & Automations',
    code: 'ALABS-OPS-N8N',
    description: 'A://Labs OPS Course — Orchestrate Agents & Automations. Dense, project-first course for engineers building AI-powered automation infrastructure. By the end, you will deploy a self-hosted n8n workflow exposed as an MCP tool. Prerequisites: Basic HTTP/API familiarity. Estimated time: 5–6 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: Why n8n Over SaaS Automation',
      'n8n Architecture',
      'Business Workflow Patterns',
      'OpenAI Agent Nodes',
      'n8n as Connector Layer',
      'Self-Hosting & Scaling',
      'Bridge: How Allternit Uses n8n',
    ],
    capstone: 'Capstone Project: Build a Self-Hosted n8n MCP Workflow',
  },
  {
    name: 'A://Labs — Computer Vision for AI Systems',
    code: 'ALABS-OPS-VISION',
    description: 'A://Labs OPS Course — Computer Vision for AI Systems. Dense, project-first course for engineers building vision-powered agents. By the end, you will build a screen-state analyzer that feeds visual context to an LLM agent. Prerequisites: Basic Python familiarity. Estimated time: 4–5 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: LLMs Are Blind',
      'OpenCV + Python Foundations',
      'Feature Detection & Tracking',
      'Face & Object Detection with Deep Learning',
      'Bridge: Connecting OpenCV to Agent Systems',
    ],
    capstone: 'Capstone Project: Build a Screen-State Analyzer for LLM Agents',
  },
  {
    name: 'A://Labs — Private RAG & Document Intelligence',
    code: 'ALABS-OPS-RAG',
    description: 'A://Labs OPS Course — Private RAG & Document Intelligence. Dense, project-first course for engineers building secure document-QA agents. By the end, you will build a document-QA agent that runs entirely offline on a laptop. Prerequisites: Basic Python familiarity. Estimated time: 3–4 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: Cloud RAG Leaks Data',
      'RAG Architecture',
      'Local LLM Inference',
      'Semantic Search Implementation',
      'Agentic RAG',
      'Bridge: Allternit\'s mcp-apps-adapter RAG',
    ],
    capstone: 'Capstone Project: Build an Offline Document-QA Agent',
  },
  {
    name: 'A://Labs — ML as Agent Tools',
    code: 'ALABS-AGENTS-ML',
    description: 'A://Labs AGENTS Course — ML as Agent Tools. Dense, project-first course for engineers who need agents to reason over structured data. By the end, you will wrap a scikit-learn model as an MCP tool that an LLM agent can invoke. Prerequisites: Basic Python familiarity. Estimated time: 4–5 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: Agents Are Bad at Structured Data Math',
      'When to Use ML vs. LLMs vs. Rules',
      'Scikit-Learn Patterns',
      'Feature Engineering for Structured Data',
      'Bridge: Wrapping ML Models as MCP Tools',
    ],
    capstone: 'Capstone Project: Wrap a Scikit-Learn Model as an MCP Tool',
  },
  {
    name: 'A://Labs — Architect Multi-Agent Systems',
    code: 'ALABS-AGENTS-AGENTS',
    description: 'A://Labs AGENTS Course — Architect Multi-Agent Systems. Dense, project-first course for engineers building autonomous agent systems. By the end, you will design a multi-agent system where specialized agents delegate tasks, share state, and produce a unified output. Prerequisites: ALABS-CORE-PROMPTS recommended. Estimated time: 4–5 hours. Assessment: Capstone project submission (no quizzes).',
    modules: [
      'The Problem: One LLM Can\'t Do Everything',
      'Agent Architecture Patterns',
      'Tool-Using Agents',
      'Code-Generation Agents',
      'Multi-Agent Orchestration',
      'Bridge: Allternit\'s Agent Swarm Communication',
    ],
    capstone: 'Capstone Project: Design a 3-Agent Collaborative Blog-Writing System',
  },
];

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function canvasApi(method: string, path: string, body?: any) {
  const url = `https://canvas.instructure.com/api/v1${path}`;
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
    throw new Error(`Canvas API ${method} ${path} failed: ${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  return await resp.json();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  await context.addCookies([
    {
      name: 'canvas_session',
      value: 'an57UoCeXIbfKa99_qeiJQ+Q-0YAMjDmjmqLIsv840Yk5lj2Ak-V9zARM1jls-fNLj-ib9yMZu3vBZAI0-wgrSWS4EIRZQ6aMU8M6KNyCl3sBJd3AfEL_GoEbNo3gEkjCDNoCIDTcVRIMcWoL08nXfWK6IVYlwQjh95Sx3R_weVl1eEvh2AmgGvSM1r3G8z_EAlETnA1MT8hBmxS3gFhPE4bfd3iYVtfNjoTcJnIuOT06F-k1fhUGxOWbze5r_qMZ4EvInzHWmEUhe7mJE1CDigwwpqzvflUUwuxCDDoQlSqXM--n5HdV3JYPlP-6oA30-rgwWHbOGu1DlgUhqIB4N9r8R4YJaLT1ioBT0XpNggFyCaC547LWnbSypodVXpkZGlDRS6-D77wUMAu6GwFqWoes0CgF5b-g4NkGGmQ5WYOQ.mfgEUUeB-amZmvDzMDULsdHjYms.ad13YQ',
      domain: 'canvas.instructure.com',
      path: '/',
      httpOnly: true,
      secure: true,
    },
    {
      name: '_csrf_token',
      value: 'KM74eNbhPLpAk1cvm1cDal3jQaKEi5DwfZ1nJvvUgscchZ0Ip7YL3TfZYnX3BmIaKIoYm8zz5LUf/B4UqqH2lA==',
      domain: 'canvas.instructure.com',
      path: '/',
      httpOnly: true,
      secure: true,
    },
    {
      name: '_twpid',
      value: 'tw.1774286281574.549337998248325749',
      domain: 'canvas.instructure.com',
      path: '/',
      secure: true,
    },
    {
      name: 'log_session_id',
      value: '929cb6a89c69b73b38a5d6259e401a45',
      domain: 'canvas.instructure.com',
      path: '/',
      secure: true,
    },
  ]);
  
  const page = await context.newPage();
  await page.goto('https://canvas.instructure.com');
  await delay(2000);
  
  const dashboardText = await page.locator('body').textContent();
  if (!dashboardText?.includes('Dashboard')) {
    console.error('Not on dashboard. Login may have failed.');
    await browser.close();
    process.exit(1);
  }
  
  console.log('✅ Logged in successfully');
  
  for (const course of COURSES) {
    console.log(`\n--- Creating course: ${course.code} ---`);
    
    // Step 1: Create course via browser (API returns 403 for course creation)
    await page.locator('button:has-text("Start a New Course")').click();
    await delay(1200);
    await page.getByLabel('Course Name').fill(course.name);
    await delay(500);
    await page.locator('button:has-text("Create")').click();
    await delay(3000);
    
    const courseUrl = page.url();
    const courseIdMatch = courseUrl.match(/\/courses\/(\d+)/);
    if (!courseIdMatch) {
      console.error(`Could not extract course ID from URL: ${courseUrl}`);
      continue;
    }
    const courseId = courseIdMatch[1];
    console.log(`  Course ID: ${courseId}`);
    
    // Handle tutorial tray if present
    const dontShow = page.locator('button:has-text("Don\'t Show Again")');
    if (await dontShow.isVisible().catch(() => false)) {
      await dontShow.click();
      await delay(600);
      const okay = page.locator('button:has-text("Okay")');
      if (await okay.isVisible().catch(() => false)) await okay.click();
      await delay(600);
    }
    
    // Step 2: Update settings via API
    await canvasApi('PUT', `/courses/${courseId}`, {
      course: {
        course_code: course.code,
        public_description: course.description,
      }
    });
    console.log(`  ✅ Settings updated`);
    
    // Step 3: Create modules via API
    const moduleIds: number[] = [];
    for (const modName of course.modules) {
      const mod = await canvasApi('POST', `/courses/${courseId}/modules`, {
        module: { name: modName, published: true }
      }) as any;
      moduleIds.push(mod.id);
    }
    
    // Create capstone module
    const capstoneMod = await canvasApi('POST', `/courses/${courseId}/modules`, {
      module: { name: course.capstone, published: true }
    }) as any;
    moduleIds.push(capstoneMod.id);
    console.log(`  ✅ ${moduleIds.length} modules created`);
    
    // Step 4: Create capstone assignment via API
    const assignment = await canvasApi('POST', `/courses/${courseId}/assignments`, {
      assignment: {
        name: course.capstone,
        submission_types: ['online_url', 'online_upload'],
        points_possible: 100,
        published: true,
      }
    }) as any;
    console.log(`  ✅ Capstone assignment created (${assignment.id})`);
    
    // Step 5: Add assignment to capstone module
    await canvasApi('POST', `/courses/${courseId}/modules/${capstoneMod.id}/items`, {
      module_item: {
        title: course.capstone,
        type: 'Assignment',
        content_id: assignment.id,
        position: 1,
        published: true,
      }
    });
    console.log(`  ✅ Assignment linked to capstone module`);
    
    // Step 6: Set prerequisites (each module requires the previous)
    for (let i = 1; i < moduleIds.length; i++) {
      await canvasApi('PUT', `/courses/${courseId}/modules/${moduleIds[i]}`, {
        module: {
          prerequisites: [{ type: 'context_module', id: moduleIds[i - 1], name: '' }]
        }
      });
    }
    console.log(`  ✅ Prerequisites set`);
    
    // Step 7: Publish course via API
    await canvasApi('PUT', `/courses/${courseId}`, {
      course: { event: 'offer' }
    });
    console.log(`  ✅ Course published`);
    
    // Back to dashboard for next course
    await page.goto('https://canvas.instructure.com');
    await delay(1500);
    
    console.log(`🎉 Completed: ${course.name}`);
  }
  
  console.log('\n✅ All 7 courses created successfully!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

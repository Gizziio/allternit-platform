import { chromium } from 'playwright';

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
    console.log(`\n--- Processing course: ${course.code} ---`);
    
    // Check if course already exists on dashboard
    const bodyText = await page.locator('body').textContent() || '';
    if (bodyText.includes(course.name)) {
      console.log(`  Course already exists on dashboard, skipping creation.`);
      continue;
    }
    
    // Click Start a New Course
    await page.locator('button:has-text("Start a New Course")').click();
    await delay(1200);
    
    // Fill course name
    await page.getByLabel('Course Name').fill(course.name);
    await delay(500);
    
    // Click Create
    await page.locator('button:has-text("Create")').click();
    await delay(3000);
    
    // Get course ID from URL
    const courseUrl = page.url();
    const courseIdMatch = courseUrl.match(/\/courses\/(\d+)/);
    if (!courseIdMatch) {
      console.error(`Could not extract course ID from URL: ${courseUrl}`);
      continue;
    }
    const courseId = courseIdMatch[1];
    console.log(`  Course ID: ${courseId}`);
    
    // Handle tutorial tray
    const dontShow = page.locator('button:has-text("Don\'t Show Again")');
    if (await dontShow.isVisible().catch(() => false)) {
      await dontShow.click();
      await delay(600);
      const okay = page.locator('button:has-text("Okay")');
      if (await okay.isVisible().catch(() => false)) await okay.click();
      await delay(600);
    }
    
    // Go to Settings directly via URL
    await page.goto(`https://canvas.instructure.com/courses/${courseId}/settings`);
    await delay(2000);
    
    // Set course code and description
    await page.locator('input#course_course_code').fill(course.code);
    await page.locator('textarea#course_public_description').fill(course.description);
    await page.locator('button:has-text("Update Course Details")').click();
    await delay(2000);
    
    // Go to Modules directly via URL
    await page.goto(`https://canvas.instructure.com/courses/${courseId}/modules`);
    await delay(2000);
    
    // Add regular modules using JS evaluation to bypass overlay issues
    for (const modName of course.modules) {
      // Click the first "Add Module" button via JS
      await page.evaluate(() => {
        const btn = document.querySelector('button.add_module_link') as HTMLButtonElement;
        if (btn) btn.click();
      });
      await delay(1000);
      
      // Fill module name and submit via JS
      await page.evaluate((name) => {
        const input = document.querySelector('input[name="context_module[name]"]') as HTMLInputElement;
        if (input) {
          input.value = name;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const submitBtn = document.querySelector('button.add_context_module_link') as HTMLButtonElement;
        if (submitBtn) submitBtn.click();
      }, modName);
      await delay(1200);
    }
    
    // Add capstone module
    await page.evaluate(() => {
      const btn = document.querySelector('button.add_module_link') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await delay(1000);
    
    await page.evaluate((name) => {
      const input = document.querySelector('input[name="context_module[name]"]') as HTMLInputElement;
      if (input) {
        input.value = name;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const submitBtn = document.querySelector('button.add_context_module_link') as HTMLButtonElement;
      if (submitBtn) submitBtn.click();
    }, course.capstone);
    await delay(1500);
    
    // Add assignment to capstone module via JS
    await page.evaluate((capstoneName) => {
      const modules = document.querySelectorAll('.context_module');
      const lastModule = modules[modules.length - 1];
      if (!lastModule) return;
      const addBtn = lastModule.querySelector('button.add_module_item_button') as HTMLButtonElement;
      if (addBtn) addBtn.click();
    }, course.capstone);
    await delay(1000);
    
    // Select assignment and fill title
    await page.locator('select[name="items[select]"]').selectOption('assignment');
    await delay(600);
    await page.locator('input[name="title"]').fill(course.capstone);
    await delay(500);
    await page.locator('button:has-text("Add Item")').click();
    await delay(1500);
    
    // Publish course
    await page.goto(`https://canvas.instructure.com/courses/${courseId}`);
    await delay(1500);
    
    const publishBtn = page.locator('button:has-text("Publish")').first();
    if (await publishBtn.isVisible().catch(() => false)) {
      await publishBtn.click();
      await delay(1200);
    }
    
    // Back to dashboard
    await page.goto('https://canvas.instructure.com');
    await delay(2000);
    
    console.log(`✅ Created: ${course.name}`);
  }
  
  console.log('\n🎉 All courses created successfully!');
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

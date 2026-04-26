#!/usr/bin/env npx tsx
/**
 * Polish ADV Courses — Full setup for A://Labs Advanced tier courses
 *
 * Usage:
 *   npx tsx scripts/polish-adv-courses.ts
 *
 * Applies to: ALABS-ADV-PLUGINSDK, ALABS-ADV-WORKFLOW, ALABS-ADV-ADAPTERS
 */

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const ADV_COURSES = [
  {
    code: 'ALABS-ADV-PLUGINSDK',
    id: 14612851,
    name: 'A://Labs ADV — Build Plugins for Allternit',
    description: 'Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, and publishing cross-platform plugins.',
    capstone: 'Build a Cross-Platform Plugin with PluginHost',
    timeEstimate: '5–6 hours',
    prerequisites: 'ALABS-CORE-COPILOT or equivalent TypeScript experience',
  },
  {
    code: 'ALABS-ADV-WORKFLOW',
    id: 14612861,
    name: 'A://Labs ADV — The Allternit Workflow Engine',
    description: 'Visual DAG orchestration, node execution, state management, and building custom workflow nodes.',
    capstone: 'Build a Custom Workflow Node',
    timeEstimate: '5–6 hours',
    prerequisites: 'ALABS-OPS-N8N or equivalent workflow experience',
  },
  {
    code: 'ALABS-ADV-ADAPTERS',
    id: 14612869,
    name: 'A://Labs ADV — Provider Adapters & Unified APIs',
    description: 'Abstraction layers, rate limiting, failover patterns, and integrating external APIs into Allternit.',
    capstone: 'Build a Provider Adapter for a New API',
    timeEstimate: '4–5 hours',
    prerequisites: 'ALABS-OPS-N8N or equivalent API integration experience',
  },
];

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

// ───────────────────────────────────────────────
// 1. Publish course & modules
// ───────────────────────────────────────────────
async function publishCourseAndModules(courseId: number, courseCode: string) {
  console.log(`\n  [Publish] ${courseCode}`);

  // Publish the course itself
  await canvasApi('PUT', `/courses/${courseId}`, {
    course: { event: 'offer' }
  }, true);
  console.log(`    ✅ Course published`);

  // Publish all modules
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  for (const mod of modules) {
    if (!mod.published) {
      await canvasApi('PUT', `/courses/${courseId}/modules/${mod.id}`, {
        module: { published: true }
      });
    }
  }
  console.log(`    ✅ ${modules.length} module(s) published`);

  // Publish all module items
  for (const mod of modules) {
    const items = await canvasApi('GET', `/courses/${courseId}/modules/${mod.id}/items?per_page=100`) as any[];
    for (const item of items) {
      if (!item.published && item.type !== 'SubHeader') {
        await canvasApi('PUT', `/courses/${courseId}/modules/${mod.id}/items/${item.id}`, {
          module_item: { published: true }
        }, true);
      }
    }
  }
  console.log(`    ✅ All items published`);
}

// ───────────────────────────────────────────────
// 2. Assignment groups + capstone
// ───────────────────────────────────────────────
async function setupAssignments(courseId: number, courseCode: string, capstoneTitle: string) {
  console.log(`\n  [Assignments] ${courseCode}`);

  // Create assignment groups
  const groups = await canvasApi('GET', `/courses/${courseId}/assignment_groups?per_page=100`) as any[];
  const groupNames = groups.map(g => g.name);

  if (!groupNames.includes('Capstone Project')) {
    await canvasApi('POST', `/courses/${courseId}/assignment_groups`, {
      assignment_group: { name: 'Capstone Project', position: 1, group_weight: 100 }
    });
    console.log(`    ✅ Created "Capstone Project" group`);
  }

  if (!groupNames.includes('Module Challenges')) {
    await canvasApi('POST', `/courses/${courseId}/assignment_groups`, {
      assignment_group: { name: 'Module Challenges', position: 2, group_weight: 0 }
    });
    console.log(`    ✅ Created "Module Challenges" group`);
  }

  // Refresh groups to get IDs
  const updatedGroups = await canvasApi('GET', `/courses/${courseId}/assignment_groups?per_page=100`) as any[];
  const capstoneGroup = updatedGroups.find(g => g.name === 'Capstone Project');

  // Check if capstone assignment exists
  const assignments = await canvasApi('GET', `/courses/${courseId}/assignments?per_page=100`) as any[];
  const hasCapstone = assignments.some(a => a.name.toLowerCase().includes('capstone'));

  if (!hasCapstone && capstoneGroup) {
    await canvasApi('POST', `/courses/${courseId}/assignments`, {
      assignment: {
        name: `Capstone Project: ${capstoneTitle}`,
        description: `<p><strong>Capstone: ${capstoneTitle}</strong></p>
<p>This is the final assessment for ${courseCode}. You will build and document a working artifact that demonstrates mastery of the course material.</p>
<p><strong>Submission requirements:</strong></p>
<ul>
<li>Working code in a GitHub repository</li>
<li>README with setup and usage instructions</li>
<li>Short demo video or GIF (optional but recommended)</li>
</ul>
<p><strong>Grading criteria:</strong></p>
<ul>
<li><strong>Correctness (40%):</strong> Does it work as specified?</li>
<li><strong>Architecture (30%):</strong> Is the code well-structured and extensible?</li>
<li><strong>Documentation (20%):</strong> Can someone else run it?</li>
<li><strong>Creativity (10%):</strong> Did you go beyond the minimum?</li>
</ul>`,
        assignment_group_id: capstoneGroup.id,
        points_possible: 100,
        published: true,
        submission_types: ['online_url', 'online_text_entry'],
      }
    });
    console.log(`    ✅ Created capstone assignment`);
  } else {
    console.log(`    ⏭️ Capstone already exists or no group`);
  }
}

// ───────────────────────────────────────────────
// 3. Welcome page (front page)
// ───────────────────────────────────────────────
async function setupWelcomePage(courseId: number, course: typeof ADV_COURSES[0]) {
  console.log(`\n  [Welcome Page] ${course.code}`);

  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  const frontPage = pages.find(p => p.front_page);
  if (frontPage) {
    console.log(`    ⏭️ Front page already exists: ${frontPage.title}`);
    return;
  }

  const html = `
<div style="max-width: 800px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
  <div style="background: #f59e0b; color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px;">
    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-bottom: 8px;">ADVANCED TIER</div>
    <h1 style="margin: 0; font-size: 32px;">${course.name}</h1>
    <p style="margin: 16px 0 0 0; font-size: 18px; line-height: 1.5; opacity: 0.95;">${course.description}</p>
  </div>

  <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
    <h2 style="margin-top: 0; color: #1e293b;">Course Structure</h2>
    <p style="color: #475569; line-height: 1.6;">
      Each module is an <strong>interactive HTML lesson</strong> generated directly from the Allternit codebase.
      You will read real code, trace data flows, and complete hands-on challenges.
    </p>
    <ul style="color: #475569; line-height: 1.8;">
      <li><strong>Interactive modules</strong> with scroll-based navigation, animated diagrams, and quizzes.</li>
      <li><strong>Code ↔ Plain English</strong> translations for every key concept.</li>
      <li><strong>Capstone project</strong> where you ship a real contribution to the Allternit ecosystem.</li>
    </ul>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Estimated Time</div>
      <div style="font-size: 20px; font-weight: 600; color: #1e293b;">${course.timeEstimate}</div>
    </div>
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Prerequisites</div>
      <div style="font-size: 16px; font-weight: 500; color: #1e293b;">${course.prerequisites}</div>
    </div>
  </div>

  <div style="background: #fffbeb; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #fcd34d;">
    <h2 style="margin-top: 0; color: #92400e;">Assessment</h2>
    <p style="color: #78350f; margin: 0;">
      This course is assessed through a <strong>capstone project submission</strong>.
      Your final project will be evaluated on correctness, architecture, documentation, and creativity.
    </p>
  </div>

  <div style="text-align: center; padding: 32px;">
    <a href="/courses/${course.id}/modules" style="display: inline-block; background: #f59e0b; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Start Learning →</a>
  </div>

  <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px; color: #64748b; font-size: 14px;">
    <p><strong>A://Labs ADV</strong> courses teach Allternit-native architecture by turning our own packages into interactive lessons. The code you study is the exact code running in production.</p>
  </div>
</div>
  `.trim();

  const page = await canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: { title: 'Welcome to A://Labs', body: html, published: true }
  }) as any;

  await canvasApi('PUT', `/courses/${courseId}/pages/${page.url}`, {
    wiki_page: { front_page: true }
  });

  await canvasApi('PUT', `/courses/${courseId}`, {
    course: { default_view: 'wiki_page' }
  }, true);

  console.log(`    ✅ Welcome page created and set as front page`);
}

// ───────────────────────────────────────────────
// 4. Curriculum Map
// ───────────────────────────────────────────────
async function addCurriculumMap(courseId: number, courseCode: string) {
  console.log(`\n  [Curriculum Map] ${courseCode}`);

  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  if (pages.find(p => p.title.toLowerCase().includes('curriculum map'))) {
    console.log(`    ⏭️ Curriculum map already exists`);
    return;
  }

  const html = `
<div style="max-width: 800px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
  <h1 style="color: #1e293b;">A://Labs Curriculum Map</h1>
  <p style="color: #475569; font-size: 16px; line-height: 1.6;">
    A://Labs is organized into four tiers: <strong>CORE</strong>, <strong>OPS</strong>, <strong>AGENTS</strong>, and <strong>ADV</strong>.
  </p>

  <div style="margin: 32px 0;">
    <div style="background: #f59e0b; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">ADVANCED TIER — Allternit Architecture</div>
    <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-ADV-PLUGINSDK — Build Plugins for Allternit</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Plugin SDK architecture, adapters, PluginHost, and cross-platform publishing.</div>
      </div>
      <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-ADV-WORKFLOW — The Allternit Workflow Engine</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Visual DAG orchestration, node execution, and custom workflow nodes.</div>
      </div>
      <div style="padding: 16px 20px;">
        <div style="font-weight: 600; color: #1e293b;">ALABS-ADV-ADAPTERS — Provider Adapters & Unified APIs</div>
        <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Abstraction layers, rate limiting, failover, and external API integration.</div>
      </div>
    </div>
  </div>

  <p style="color: #475569; font-size: 14px;">
    ADV courses are generated directly from the Allternit codebase. Each interactive module contains real source code, animated architecture diagrams, and hands-on quizzes.
  </p>
</div>
  `.trim();

  await canvasApi('POST', `/courses/${courseId}/pages`, {
    wiki_page: { title: 'A://Labs Curriculum Map', body: html, published: true }
  });
  console.log(`    ✅ Curriculum map created`);
}

// ───────────────────────────────────────────────
// 5. Syllabus
// ───────────────────────────────────────────────
async function addSyllabus(courseId: number, course: typeof ADV_COURSES[0]) {
  console.log(`\n  [Syllabus] ${course.code}`);

  const courseDetails = await canvasApi('GET', `/courses/${courseId}?include[]=syllabus_body`) as any;
  if (courseDetails.syllabus_body && courseDetails.syllabus_body.length > 50) {
    console.log(`    ⏭️ Syllabus already set`);
    return;
  }

  const html = `
<h1>Course Syllabus: ${course.name}</h1>
<p><strong>Course Code:</strong> ${course.code}<br><strong>Tier:</strong> ADVANCED<br><strong>Estimated Time:</strong> ${course.timeEstimate}<br><strong>Prerequisites:</strong> ${course.prerequisites}</p>
<h2>Course Description</h2>
<p>${course.description} This ADV course is generated directly from the Allternit codebase. You will study real production code, trace data flows through animated diagrams, and complete interactive quizzes that test application-level understanding.</p>
<h2>Learning Outcomes</h2>
<ul>
<li>Read and navigate the Allternit ${course.code.split('-').pop()?.toLowerCase()} source code with confidence</li>
<li>Understand the architecture decisions that shape the platform</li>
<li>Build extensions and integrations that fit the existing patterns</li>
<li>Debug issues by tracing data flows through the system</li>
</ul>
<h2>Assessment</h2>
<p>One capstone project (100 points): <strong>${course.capstone}</strong>. Module challenges are ungraded practice assignments (10 points each) designed to build muscle memory.</p>
<h2>Policies</h2>
<p>All work must be your own. AI assistance is encouraged, but you must understand and be able to explain every architectural decision you make. Capstone projects may be submitted as GitHub repositories with documentation.</p>
  `.trim();

  await canvasApi('PUT', `/courses/${courseId}`, {
    course: { syllabus_body: html }
  });
  console.log(`    ✅ Syllabus set`);
}

// ───────────────────────────────────────────────
// 6. Welcome Announcement
// ───────────────────────────────────────────────
async function postWelcomeAnnouncement(courseId: number, course: typeof ADV_COURSES[0]) {
  console.log(`\n  [Announcement] ${course.code}`);

  // Check for existing welcome announcement
  const topics = await canvasApi('GET', `/courses/${courseId}/discussion_topics?per_page=100`) as any[];
  const hasWelcome = topics.some(t => t.title.toLowerCase().includes('welcome'));
  if (hasWelcome) {
    console.log(`    ⏭️ Welcome announcement already exists`);
    return;
  }

  const html = `<p>Welcome to <strong>${course.code}</strong>.</p>
<p>${course.description} This is an ADVANCED tier course — the code you study is the exact code running in the Allternit platform.</p>
<p><strong>How to succeed:</strong></p>
<ul>
<li>Work through modules sequentially. Each interactive lesson builds on the previous.</li>
<li>Don't just read — click through the animated diagrams and attempt every quiz.</li>
<li>The capstone asks you to build on top of the actual package. Treat it like a real PR.</li>
</ul>
<p>See the <a href="/courses/${courseId}/pages/a-slash-slash-labs-curriculum-map">Curriculum Map</a> for the full A://Labs path.</p>
<p>Good luck.<br>— A://Labs</p>`;

  await canvasApi('POST', `/courses/${courseId}/discussion_topics`, {
    title: `Welcome to A://Labs — ${course.name}`,
    message: html,
    is_announcement: true,
    published: true,
  });
  console.log(`    ✅ Welcome announcement posted`);
}

// ───────────────────────────────────────────────
// 7. Course settings (tabs, visibility)
// ───────────────────────────────────────────────
async function updateSettings(courseId: number, courseCode: string) {
  console.log(`\n  [Settings] ${courseCode}`);

  await canvasApi('PUT', `/courses/${courseId}`, {
    course: {
      public_description: courseCode,
      is_public: false,
      is_public_to_auth_users: true,
      public_syllabus: false,
    }
  });

  const tabs = await canvasApi('GET', `/courses/${courseId}/tabs`) as any[];
  const desired: Record<string, boolean> = {
    home: true, announcements: true, assignments: true, discussions: false,
    grades: true, people: false, pages: true, files: false,
    syllabus: true, outcomes: false, quizzes: false, modules: true,
    settings: false, collaborations: false, conferences: false,
  };

  for (const tab of tabs) {
    if (!tab.label) continue;
    const shouldShow = desired[tab.id] ?? (tab.visibility === 'public');
    const currentHidden = tab.hidden === true;
    if (currentHidden === !shouldShow) continue;

    await canvasApi('PUT', `/courses/${courseId}/tabs/${tab.id}`, {
      tab: { hidden: !shouldShow }
    }, true);
  }
  console.log(`    ✅ Settings updated`);
}

// ───────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  POLISHING ADV COURSES');
  console.log('═══════════════════════════════════════════════════════════════');

  for (const course of ADV_COURSES) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  ${course.code} (${course.id})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    await publishCourseAndModules(course.id, course.code);
    await setupAssignments(course.id, course.code, course.capstone);
    await setupWelcomePage(course.id, course);
    await addCurriculumMap(course.id, course.code);
    await addSyllabus(course.id, course);
    await postWelcomeAnnouncement(course.id, course);
    await updateSettings(course.id, course.code);

    console.log(`\n  ✅ ${course.code} fully polished`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ALL ADV COURSES POLISHED');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

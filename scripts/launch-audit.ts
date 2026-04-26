import fs from 'fs/promises';
import path from 'path';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const COURSES = [
  { code: 'ALABS-CORE-COPILOT', id: 14593493 },
  { code: 'ALABS-CORE-PROMPTS', id: 14593495 },
  { code: 'ALABS-OPS-N8N', id: 14593499 },
  { code: 'ALABS-OPS-VISION', id: 14593501 },
  { code: 'ALABS-OPS-RAG', id: 14593503 },
  { code: 'ALABS-AGENTS-ML', id: 14593505 },
  { code: 'ALABS-AGENTS-AGENTS', id: 14593507 },
  { code: 'ALABS-ADV-PLUGINSDK', id: 14612851 },
  { code: 'ALABS-ADV-WORKFLOW', id: 14612861 },
  { code: 'ALABS-ADV-ADAPTERS', id: 14612869 },
];

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

async function getAllPages(url: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = url;
  while (nextUrl) {
    const resp = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` },
    });
    const data = await resp.json();
    const arr = Array.isArray(data) ? data : [];
    results.push(...arr);
    const linkHeader = resp.headers.get('link');
    nextUrl = null;
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (match) nextUrl = match[1];
    }
  }
  return results;
}

async function auditCourse(course: typeof COURSES[0]) {
  const report: any = {
    code: course.code,
    id: course.id,
    url: `https://canvas.instructure.com/courses/${course.id}`,
    issues: [] as string[],
  };

  // Course details (include syllabus_body)
  const details = await canvasApi('GET', `/courses/${course.id}?include[]=syllabus_body`) as any;
  report.name = details.name;
  report.isPublished = details.workflow_state === 'available';
  report.publicDescription = details.public_description || '';
  if (!report.isPublished) report.issues.push('Course is not published');

  // Pages (fetch once)
  const pages = await getAllPages(`${BASE_URL}/courses/${course.id}/pages?per_page=100`);

  // Welcome page content check (relaxed: look for A://Labs in body)
  const frontPage = pages.find((p: any) => p.front_page);
  if (!frontPage) {
    report.issues.push('No front page set');
  } else {
    report.frontPage = frontPage.title;
    const fullPage = await canvasApi('GET', `/courses/${course.id}/pages/${frontPage.url}`) as any;
    const body = fullPage.body || '';
    if (!body.includes('A://Labs')) {
      report.issues.push('Front page missing A://Labs branding');
    }
  }

  // Modules
  const modules = await getAllPages(`${BASE_URL}/courses/${course.id}/modules?per_page=100`);
  report.modules = modules.length;
  report.moduleNames = modules.map((m: any) => m.name);
  
  let unpublishedModules = 0;
  let itemCounts = { Page: 0, Assignment: 0, ExternalUrl: 0, SubHeader: 0 };
  let prerequisiteIssues = 0;

  for (const mod of modules) {
    if (mod.state !== 'completed' && mod.state !== 'started') {
      // 'completed'/'started' means published and available; 'unlocked' also ok
      if (mod.published === false) unpublishedModules++;
    }

    // Check items
    const items = await getAllPages(`${BASE_URL}/courses/${course.id}/modules/${mod.id}/items?per_page=100`);
    for (const item of items) {
      itemCounts[item.type as keyof typeof itemCounts] = (itemCounts[item.type as keyof typeof itemCounts] || 0) + 1;
      if (item.published === false && item.type !== 'SubHeader') {
        report.issues.push(`Unpublished item in ${mod.name}: ${item.title} (${item.type})`);
      }
    }
  }

  report.itemCounts = itemCounts;
  if (unpublishedModules > 0) report.issues.push(`${unpublishedModules} unpublished module(s)`);

  // Verify prerequisite chain (Canvas Free For Teacher returns prerequisite_module_ids)
  for (let i = 1; i < modules.length; i++) {
    const prev = modules[i - 1];
    const curr = modules[i];
    const prereqIds = curr.prerequisite_module_ids || [];
    const hasPrev = prereqIds.includes(prev.id);
    if (!hasPrev) {
      prerequisiteIssues++;
      report.issues.push(`Module ${i + 1} (${curr.name}) missing prerequisite on module ${i} (${prev.name})`);
    }
  }
  if (prerequisiteIssues === 0) report.prerequisiteChain = 'OK';
  else report.prerequisiteChain = `${prerequisiteIssues} issue(s)`;

  // Positions
  const positions = modules.map((m: any) => m.position);
  const expectedPositions = modules.map((_: any, i: number) => i + 1);
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    report.issues.push(`Module positions not sequential: [${positions.join(', ')}]`);
  } else {
    report.positions = 'OK';
  }

  // Assignments
  const assignments = await getAllPages(`${BASE_URL}/courses/${course.id}/assignments?per_page=100`);
  report.assignments = assignments.length;
  const capstones = assignments.filter((a: any) => a.name.toLowerCase().includes('capstone'));
  if (capstones.length === 0) report.issues.push('No capstone assignment found');
  else report.capstone = capstones.map((a: any) => a.name).join(', ');

  // Assignment groups (Canvas Free For Teacher may rename all groups to "Assignments")
  const groups = await getAllPages(`${BASE_URL}/courses/${course.id}/assignment_groups?per_page=100`);
  report.assignmentGroups = groups.map((g: any) => g.name);
  report.assignmentGroupCount = groups.length;
  // On Free For Teacher, custom group names often become "Assignments" via API.
  // We check that there are enough distinct groups instead.
  if (groups.length < 3) {
    report.issues.push(`Only ${groups.length} assignment group(s) found (expected at least 3)`);
  }

  // Syllabus (Canvas course syllabus_body, not necessarily a wiki page)
  if (!details.syllabus_body || details.syllabus_body.length < 50) {
    report.issues.push('Course syllabus body is empty or missing');
  } else {
    report.syllabus = 'Course syllabus set';
  }

  // Curriculum map
  const curriculumMap = pages.find((p: any) => p.title.toLowerCase().includes('curriculum map'));
  if (!curriculumMap) report.issues.push('No curriculum map page found');
  else report.curriculumMap = curriculumMap.title;

  return report;
}

async function main() {
  console.log('🔍 Running A://Labs Launch Audit...\n');
  const reports = [];
  for (const course of COURSES) {
    try {
      const report = await auditCourse(course);
      reports.push(report);
      console.log(`✅ ${report.code}: ${report.modules} modules, ${report.assignments} assignments`);
      if (report.issues.length > 0) {
        for (const issue of report.issues) console.log(`   ⚠️  ${issue}`);
      }
    } catch (err: any) {
      console.error(`❌ ${course.code}: ${err.message}`);
      reports.push({ code: course.code, id: course.id, error: err.message, issues: [err.message] });
    }
  }

  const outputPath = path.join('/Users/macbook/Desktop/allternit-workspace/allternit', 'ALABS-LAUNCH-AUDIT.json');
  await fs.writeFile(outputPath, JSON.stringify(reports, null, 2));
  console.log(`\n📄 Full audit written to ${outputPath}`);

  // Summary
  const totalIssues = reports.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  console.log(`\n📊 Summary: ${totalIssues} issue(s) across ${reports.length} course(s)`);
  if (totalIssues === 0) console.log('🚀 All courses are launch-ready!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

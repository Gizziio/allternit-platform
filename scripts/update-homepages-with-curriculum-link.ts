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

async function updateHomepage(courseId: number, courseCode: string) {
  console.log(`\n--- Updating homepage for ${courseCode} ---`);
  
  const pages = await canvasApi('GET', `/courses/${courseId}/pages?per_page=100`) as any[];
  const frontPage = pages.find(p => p.front_page);
  
  if (!frontPage) {
    console.log(`  ⚠️ No front page found`);
    return;
  }
  
  // Fetch full page content
  const pageDetail = await canvasApi('GET', `/courses/${courseId}/pages/${frontPage.url}`) as any;
  let html = pageDetail.body;
  
  // Add curriculum map link before the "Start Learning" button if not already present
  if (!html.includes('View Full Curriculum')) {
    html = html.replace(
      '<div style="text-align: center; padding: 32px;">',
      `<div style="text-align: center; padding: 16px 32px;">
    <a href="/courses/${courseId}/pages/a-slash-slash-labs-curriculum-map" style="display: inline-block; background: #f1f5f9; color: #334155; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px; margin-bottom: 8px;">View Full Curriculum Map</a>
  </div>
  <div style="text-align: center; padding: 32px;">`
    );
    
    await canvasApi('PUT', `/courses/${courseId}/pages/${frontPage.url}`, {
      wiki_page: { body: html }
    });
    console.log(`  ✅ Added curriculum map link to homepage`);
  } else {
    console.log(`  ⏭️ Homepage already has curriculum map link`);
  }
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Updating homepages for ${courses.length} courses...`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await updateHomepage(course.id, course.course_code);
  }
  
  console.log('\n✅ Homepages updated!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

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

async function main() {
  const courses = await getMyCourses();
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    const resp = await fetch(`${BASE_URL}/courses/${course.id}/assignments?per_page=100`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const assignments = await resp.json();
    console.log(`\n${course.course_code}:`);
    for (const a of assignments) {
      const descLen = a.description ? a.description.length : 0;
      console.log(`  ${a.name} | ${a.points_possible} pts | desc=${descLen} chars`);
    }
  }
}

main().catch(console.error);

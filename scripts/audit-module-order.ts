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
  let issuesFound = 0;
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    const modulesResp = await fetch(`${BASE_URL}/courses/${course.id}/modules?per_page=100`, {
      headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
    });
    const modules = await modulesResp.json();
    
    for (const mod of modules) {
      const itemsResp = await fetch(`${BASE_URL}/courses/${course.id}/modules/${mod.id}/items?per_page=100`, {
        headers: { Authorization: `Bearer ${CANVAS_TOKEN}` }
      });
      const items = await itemsResp.json();
      
      // Check if challenge assignment comes before any Page
      const challengeIndex = items.findIndex((i: any) => i.type === 'Assignment' && i.title.includes('Challenge:'));
      const pageIndex = items.findIndex((i: any) => i.type === 'Page');
      
      if (challengeIndex >= 0 && pageIndex >= 0 && challengeIndex < pageIndex) {
        console.log(`  ❌ ${course.course_code} / ${mod.name}: Challenge (${challengeIndex}) comes before Page (${pageIndex})`);
        issuesFound++;
      }
      
      // Check if capstone page comes after capstone assignment
      if (mod.name.toLowerCase().includes('capstone')) {
        const capPageIndex = items.findIndex((i: any) => i.type === 'Page');
        const capAssignIndex = items.findIndex((i: any) => i.type === 'Assignment');
        if (capAssignIndex >= 0 && capPageIndex >= 0 && capAssignIndex < capPageIndex) {
          console.log(`  ❌ ${course.course_code} / ${mod.name}: Assignment comes before Context Page`);
          issuesFound++;
        }
      }
    }
  }
  
  if (issuesFound === 0) {
    console.log('✅ All module item ordering is correct');
  } else {
    console.log(`\n⚠️ Found ${issuesFound} ordering issues`);
  }
}

main().catch(console.error);

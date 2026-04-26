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

async function publishModules(courseId: number, courseCode: string) {
  console.log(`\n--- Publishing modules for ${courseCode} ---`);
  const modules = await canvasApi('GET', `/courses/${courseId}/modules?per_page=100`) as any[];
  
  let published = 0;
  for (const mod of modules) {
    if (!mod.published) {
      await canvasApi('PUT', `/courses/${courseId}/modules/${mod.id}`, {
        module: { published: true }
      });
      published++;
      console.log(`  ✅ Published: ${mod.name}`);
    }
  }
  
  if (published === 0) {
    console.log(`  ⏭️ All ${modules.length} modules already published`);
  } else {
    console.log(`  ✅ Published ${published}/${modules.length} modules`);
  }
}

async function main() {
  const courses = await getMyCourses();
  console.log(`Publishing modules for ${courses.length} courses...`);
  
  for (const course of courses.sort((a, b) => a.course_code.localeCompare(b.course_code))) {
    await publishModules(course.id, course.course_code);
  }
  
  console.log('\n🎉 All modules published!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

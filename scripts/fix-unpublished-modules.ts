const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const COURSES = [
  { id: '14612851', name: 'ALABS-ADV-PLUGINSDK' },
  { id: '14612861', name: 'ALABS-ADV-WORKFLOW' },
  { id: '14612869', name: 'ALABS-ADV-ADAPTERS' },
];

async function canvasApi(method: string, pathStr: string, body?: any) {
  const url = `${BASE_URL}${pathStr}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CANVAS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Canvas API ${method} ${pathStr} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function publishModule(courseId: string, moduleId: number) {
  await canvasApi('PUT', `/courses/${courseId}/modules/${moduleId}`, {
    module: { published: true },
  });
}

async function publishModuleItems(courseId: string, moduleId: number) {
  const items = await canvasApi('GET', `/courses/${courseId}/modules/${moduleId}/items?per_page=100`) as any[];
  for (const item of items) {
    if (!item.published) {
      await canvasApi('PUT', `/courses/${courseId}/modules/${moduleId}/items/${item.id}`, {
        module_item: { published: true },
      });
    }
  }
}

async function setPrerequisite(courseId: string, moduleId: number, prereqModuleId: number) {
  await canvasApi('PUT', `/courses/${courseId}/modules/${moduleId}`, {
    module: {
      prerequisite_module_ids: [prereqModuleId],
    },
  });
}

async function fixCourse(course: typeof COURSES[0]) {
  console.log(`\n--- Fixing ${course.name} ---`);
  const modules = await canvasApi('GET', `/courses/${course.id}/modules?per_page=100`) as any[];
  
  // Sort by position to get module order
  const sorted = modules.sort((a, b) => a.position - b.position);
  
  for (const mod of sorted) {
    if (!mod.published) {
      console.log(`  Publishing module: ${mod.name}`);
      await publishModule(course.id, mod.id);
    }
    await publishModuleItems(course.id, mod.id);
    console.log(`  ✅ Module ${mod.name} published`);
  }
  
  // Set prerequisites: each module requires the previous one
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    console.log(`  Setting prerequisite: ${curr.name} requires ${prev.name}`);
    await setPrerequisite(course.id, curr.id, prev.id);
  }
  
  console.log(`  ✅ ${course.name} fixed`);
}

async function main() {
  for (const course of COURSES) {
    await fixCourse(course);
  }
  console.log('\n🚀 All courses fixed!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

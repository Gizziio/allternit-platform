const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const COURSES = [
  { id: 14612851, code: 'ALABS-ADV-PLUGINSDK', capstone: 'Build a Cross-Platform Plugin with PluginHost' },
  { id: 14612861, code: 'ALABS-ADV-WORKFLOW', capstone: 'Build a Custom Workflow Node' },
  { id: 14612869, code: 'ALABS-ADV-ADAPTERS', capstone: 'Build a Provider Adapter for a New API' },
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
    throw new Error(`${resp.status} ${text}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

async function main() {
  for (const c of COURSES) {
    const groups = await canvasApi('GET', `/courses/${c.id}/assignment_groups?per_page=100`) as any[];
    
    // On Free For Teacher, custom group names become "Assignments" via API.
    // We use the groups by position: first = Capstone, second = Module Challenges.
    const sortedGroups = groups.sort((a: any, b: any) => a.position - b.position);
    const capGroup = sortedGroups[0];
    
    if (!capGroup) {
      console.log(`No assignment groups for ${c.code}`);
      continue;
    }

    // Check if capstone already exists
    const assignments = await canvasApi('GET', `/courses/${c.id}/assignments?per_page=100`) as any[];
    const hasCapstone = assignments.some((a: any) => a.name.toLowerCase().includes('capstone'));
    
    if (hasCapstone) {
      console.log(`⏭️ Capstone already exists for ${c.code}`);
      continue;
    }

    await canvasApi('POST', `/courses/${c.id}/assignments`, {
      assignment: {
        name: `Capstone Project: ${c.capstone}`,
        description: `<p><strong>Capstone: ${c.capstone}</strong></p>
<p>This is the final assessment for ${c.code}. You will build and document a working artifact that demonstrates mastery of the course material.</p>
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
        assignment_group_id: capGroup.id,
        points_possible: 100,
        published: true,
        submission_types: ['online_url', 'online_text_entry'],
      }
    });
    console.log(`✅ Created capstone for ${c.code}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

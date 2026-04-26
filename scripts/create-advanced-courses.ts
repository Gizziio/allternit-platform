#!/usr/bin/env npx tsx
/**
 * Create Advanced A://Labs courses in Canvas
 */

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

const ADVANCED_COURSES = [
  {
    code: 'ALABS-ADV-PLUGINSDK',
    name: 'A://Labs ADV — Build Plugins for Allternit',
    description: 'Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, and publishing cross-platform plugins.',
    tier: 'ADV',
  },
  {
    code: 'ALABS-ADV-WORKFLOW',
    name: 'A://Labs ADV — The Allternit Workflow Engine',
    description: 'Visual DAG orchestration, node execution, state management, and building custom workflow nodes.',
    tier: 'ADV',
  },
  {
    code: 'ALABS-ADV-ADAPTERS',
    name: 'A://Labs ADV — Provider Adapters & Unified APIs',
    description: 'Abstraction layers, rate limiting, failover patterns, and integrating external APIs into Allternit.',
    tier: 'ADV',
  },
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
  if (resp.status === 204) return undefined;
  return resp.json();
}

async function main() {
  for (const course of ADVANCED_COURSES) {
    try {
      const created = await canvasApi('POST', '/accounts/self/courses', {
        course: {
          name: course.name,
          course_code: course.code,
          public_description: course.description,
          is_public: true,
          is_public_to_auth_users: true,
          public_syllabus: true,
          public_syllabus_to_auth: true,
          license: 'private',
        },
      }) as any;

      console.log(`✅ Created ${course.code}: ${created.id} — https://canvas.instructure.com/courses/${created.id}`);
    } catch (err: any) {
      console.error(`❌ Failed to create ${course.code}: ${err.message}`);
    }
  }
}

main();

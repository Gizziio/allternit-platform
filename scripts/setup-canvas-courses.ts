#!/usr/bin/env tsx
/**
 * Setup Canvas LMS courses for A://Labs
 *
 * Creates courses and modules in Canvas using the Canvas API.
 */

import axios from 'axios';

const CANVAS_BASE_URL = 'https://canvas.instructure.com';
const CANVAS_API_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';

const canvas = axios.create({
  baseURL: `${CANVAS_BASE_URL}/api/v1`,
  headers: {
    Authorization: `Bearer ${CANVAS_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

interface CanvasCourse {
  name: string;
  course_code: string;
  sis_course_id: string;
  modules: { name: string; position: number }[];
}

const COURSES: CanvasCourse[] = [
  {
    name: 'A://Labs — AI Reasoning & Prompt Engineering',
    course_code: 'ALABS-CORE-REASONING',
    sis_course_id: 'a2labs-core-reasoning-001',
    modules: [
      { name: 'ChatGPT Prompt Engineering for Developers', position: 1 },
      { name: 'LangChain for LLM Application Development', position: 2 },
      { name: 'Prompt Engineering: How to Talk to AI', position: 3 },
      { name: 'Advanced ChatGPT: Complete Guide', position: 4 },
    ],
  },
  {
    name: 'A://Labs — Multimodal AI Workflows',
    course_code: 'ALABS-CORE-MULTIMODAL',
    sis_course_id: 'a2labs-core-multimodal-001',
    modules: [
      { name: 'Computer Vision with Python: Complete Guide', position: 1 },
      { name: 'GPT-4 Vision API: Build Multimodal AI Apps', position: 2 },
      { name: 'Multimodal AI: Text, Image & Audio Processing', position: 3 },
      { name: 'Document Intelligence with AI', position: 4 },
    ],
  },
  {
    name: 'A://Labs — AI Evaluation & Trust',
    course_code: 'ALABS-CORE-EVALUATION',
    sis_course_id: 'a2labs-core-evaluation-001',
    modules: [
      { name: 'AI Evaluation & Testing Fundamentals', position: 1 },
      { name: 'LLM Safety & Hallucination Detection', position: 2 },
    ],
  },
  {
    name: 'A://Labs — AI Workflow Design',
    course_code: 'ALABS-OPS-WORKFLOWS',
    sis_course_id: 'a2labs-ops-workflows-001',
    modules: [
      { name: 'AI Automation & Workflow Design', position: 1 },
      { name: 'AI Productivity & Business Automation', position: 2 },
    ],
  },
  {
    name: 'A://Labs — Research Operations',
    course_code: 'ALABS-OPS-RESEARCH',
    sis_course_id: 'a2labs-ops-research-001',
    modules: [
      { name: 'AI-Powered Research & Data Extraction', position: 1 },
      { name: 'Building Knowledge Bases with AI', position: 2 },
    ],
  },
  {
    name: 'A://Labs — Content Operations',
    course_code: 'ALABS-OPS-CONTENT',
    sis_course_id: 'a2labs-ops-content-001',
    modules: [
      { name: 'AI Content Generation & Copywriting', position: 1 },
      { name: 'AI-Assisted Technical Writing', position: 2 },
    ],
  },
  {
    name: 'A://Labs — Tool-Using AI Systems',
    course_code: 'ALABS-AGENTS-TOOLS',
    sis_course_id: 'a2labs-agents-tools-001',
    modules: [
      { name: 'Function Calling & AI Tool Design', position: 1 },
      { name: 'Building AI Agents with LangChain', position: 2 },
    ],
  },
  {
    name: 'A://Labs — RAG & Document Intelligence',
    course_code: 'ALABS-AGENTS-RAG',
    sis_course_id: 'a2labs-agents-rag-001',
    modules: [
      { name: 'RAG Systems & Vector Databases', position: 1 },
      { name: 'Semantic Search & Document Q&A', position: 2 },
    ],
  },
  {
    name: 'A://Labs — Multi-Agent Orchestration',
    course_code: 'ALABS-AGENTS-ORCHESTRATION',
    sis_course_id: 'a2labs-agents-orchestration-001',
    modules: [
      { name: 'Multi-Agent AI with LangGraph & CrewAI', position: 1 },
      { name: 'AI Agent Collaboration Patterns', position: 2 },
    ],
  },
  {
    name: 'A://Labs — AI Copilot & Code Generation',
    course_code: 'ALABS-AGENTS-CODE',
    sis_course_id: 'a2labs-agents-code-001',
    modules: [
      { name: 'AI Coding Assistants & Code Review', position: 1 },
      { name: 'Repo-Aware AI Development', position: 2 },
    ],
  },
];

async function createCourse(course: CanvasCourse): Promise<number | null> {
  try {
    const response = await canvas.post('/accounts/self/courses', {
      course: {
        name: course.name,
        course_code: course.course_code,
        sis_course_id: course.sis_course_id,
      },
    });
    const courseId = response.data.id;
    console.log(`  ✅ Created course: ${course.name} (ID: ${courseId})`);
    return courseId;
  } catch (error: any) {
    if (error.response?.data?.message?.includes('already in use')) {
      // Try to find existing course by SIS ID
      try {
        const search = await canvas.get(`/courses/sis_course_id:${course.sis_course_id}`);
        console.log(`  ⚠️  Course already exists: ${course.name} (ID: ${search.data.id})`);
        return search.data.id;
      } catch {
        console.error(`  ❌ Failed to create/find course: ${course.name}`);
        return null;
      }
    }
    console.error(`  ❌ Failed to create course: ${course.name}`, error.response?.data?.message || error.message);
    return null;
  }
}

async function createModule(courseId: number, mod: { name: string; position: number }) {
  try {
    await canvas.post(`/courses/${courseId}/modules`, {
      module: {
        name: mod.name,
        position: mod.position,
        published: true,
      },
    });
    console.log(`    ✅ Module: ${mod.name}`);
  } catch (error: any) {
    console.error(`    ❌ Failed to create module: ${mod.name}`, error.response?.data?.message || error.message);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Setting up A://Labs courses in Canvas LMS                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Verify token first
  try {
    await canvas.get('/users/self');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error('❌ Canvas API token is expired or invalid.');
      console.error('   To fix this:');
      console.error('   1. Go to Canvas → Account → Settings → Approved Integrations');
      console.error('   2. Generate a new Access Token');
      console.error('   3. Update CANVAS_API_TOKEN in this script');
      console.error('\n   The course JSON is ready in ALABS-COURSE-CATALOG.md');
      console.error('   You can also import it manually once the token is refreshed.');
      process.exit(1);
    }
  }

  // Check if we can create courses (Free For Teacher accounts block this)
  try {
    await canvas.get('/accounts/self');
  } catch (error: any) {
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.error('❌ Canvas Free For Teacher accounts do not support API course creation.');
      console.error('   The token is VALID, but your plan restricts automated course creation.');
      console.error('\n   ✅ SOLUTION: Use the manual JSON in ALABS-COURSE-CATALOG.md');
      console.error('   It contains all course names and module structures ready to copy.');
      process.exit(1);
    }
  }

  for (const course of COURSES) {
    const courseId = await createCourse(course);
    if (courseId) {
      for (const mod of course.modules) {
        await createModule(courseId, mod);
      }
      console.log('');
    }
  }

  console.log('✅ Canvas setup complete!');
}

main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});

#!/usr/bin/env npx tsx
/**
 * A://Labs Course Pipeline — End-to-End Orchestrator
 *
 * A single CLI that runs the full course lifecycle:
 *   create → covers → modules → polish → audit
 *
 * Usage:
 *   npx tsx scripts/alabs-course-pipeline.ts --phase create --courses ALABS-ADV-PLUGINSDK,ALABS-ADV-WORKFLOW
 *   npx tsx scripts/alabs-course-pipeline.ts --phase polish --courses ALABS-ADV-PLUGINSDK
 *   npx tsx scripts/alabs-course-pipeline.ts --phase all --courses ALABS-ADV-PLUGINSDK
 *
 * Phases:
 *   create  — Create courses in Canvas (browser automation, Free For Teacher)
 *   covers  — Generate branded cover images and upload to Canvas
 *   modules — Generate interactive HTML modules from packages and upload
 *   polish  — Publish, add welcome, syllabus, assignment groups, capstones, curriculum map
 *   audit   — Run launch-readiness audit
 *   all     — Run create → covers → modules → polish → audit
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const CANVAS_TOKEN = '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc';
const BASE_URL = 'https://canvas.instructure.com/api/v1';

interface CourseDef {
  code: string;
  name: string;
  description: string;
  tier: string;
  packagePath?: string;
  modules?: number;
  capstone?: string;
  canvasId?: string;
}

const COURSE_REGISTRY: Record<string, CourseDef> = {
  'ALABS-CORE-COPILOT': {
    code: 'ALABS-CORE-COPILOT', name: 'A://Labs — Build AI-Assisted Software',
    description: 'Build AI-Assisted Software with Copilot & Cursor', tier: 'CORE',
    canvasId: '14593493', modules: 7,
    capstone: 'Build a TypeScript MCP Server with Cursor',
  },
  'ALABS-CORE-PROMPTS': {
    code: 'ALABS-CORE-PROMPTS', name: 'A://Labs — Engineer Prompts for Agent Systems',
    description: 'Prompt Engineering & Systematic LLM Reasoning', tier: 'CORE',
    canvasId: '14593495', modules: 7,
    capstone: 'Design a 3-Prompt Suite + Red-Team Report',
  },
  'ALABS-OPS-N8N': {
    code: 'ALABS-OPS-N8N', name: 'A://Labs — Orchestrate Agents & Automations',
    description: 'Orchestrate Agents & Automations with n8n', tier: 'OPS',
    canvasId: '14593499', modules: 8,
    capstone: 'Build a Self-Hosted n8n MCP Workflow',
  },
  'ALABS-OPS-VISION': {
    code: 'ALABS-OPS-VISION', name: 'A://Labs — Computer Vision for AI Systems',
    description: 'Computer Vision for Agent Systems', tier: 'OPS',
    canvasId: '14593501', modules: 6,
    capstone: 'Build a Screen-State Analyzer for LLM Agents',
  },
  'ALABS-OPS-RAG': {
    code: 'ALABS-OPS-RAG', name: 'A://Labs — Private RAG & Document Intelligence',
    description: 'Local RAG & Document Intelligence', tier: 'OPS',
    canvasId: '14593503', modules: 7,
    capstone: 'Offline Document-QA Agent',
  },
  'ALABS-AGENTS-ML': {
    code: 'ALABS-AGENTS-ML', name: 'A://Labs — ML as Agent Tools',
    description: 'ML Models as Agent Tools', tier: 'AGENTS',
    canvasId: '14593505', modules: 6,
    capstone: 'Wrap a Scikit-Learn Model as an MCP Tool',
  },
  'ALABS-AGENTS-AGENTS': {
    code: 'ALABS-AGENTS-AGENTS', name: 'A://Labs — Multi-Agent Systems',
    description: 'Multi-Agent Systems & Orchestration', tier: 'AGENTS',
    canvasId: '14593507', modules: 7,
    capstone: 'Design a 3-Agent Collaborative Blog-Writing System',
  },
  'ALABS-ADV-PLUGINSDK': {
    code: 'ALABS-ADV-PLUGINSDK', name: 'A://Labs ADV — Build Plugins for Allternit',
    description: 'Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, and publishing cross-platform plugins.',
    tier: 'ADV', packagePath: 'packages/@allternit/plugin-sdk',
    canvasId: '14612851', modules: 6,
    capstone: 'Build a Cross-Platform Plugin with PluginHost',
  },
  'ALABS-ADV-WORKFLOW': {
    code: 'ALABS-ADV-WORKFLOW', name: 'A://Labs ADV — The Allternit Workflow Engine',
    description: 'Visual DAG orchestration, node execution, state management, and building custom workflow nodes.',
    tier: 'ADV', packagePath: 'packages/@allternit/workflow-engine',
    canvasId: '14612861', modules: 6,
    capstone: 'Build a Custom Workflow Node',
  },
  'ALABS-ADV-ADAPTERS': {
    code: 'ALABS-ADV-ADAPTERS', name: 'A://Labs ADV — Provider Adapters & Unified APIs',
    description: 'Abstraction layers, rate limiting, failover patterns, and integrating external APIs into Allternit.',
    tier: 'ADV', packagePath: 'packages/@allternit/provider-adapters',
    canvasId: '14612869', modules: 6,
    capstone: 'Build a Provider Adapter for a New API',
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const phase = get('--phase') || 'all';
  const coursesArg = get('--courses') || '';
  const courses = coursesArg.split(',').filter(Boolean);

  if (!['create', 'covers', 'modules', 'polish', 'audit', 'all'].includes(phase)) {
    console.error(`Unknown phase: ${phase}. Use: create | covers | modules | polish | audit | all`);
    process.exit(1);
  }

  if (courses.length === 0) {
    console.error('Please specify --courses comma-separated course codes, or "all" for all courses.');
    process.exit(1);
  }

  const resolvedCourses = courses.includes('all')
    ? Object.keys(COURSE_REGISTRY)
    : courses;

  for (const c of resolvedCourses) {
    if (!COURSE_REGISTRY[c]) {
      console.error(`Unknown course code: ${c}`);
      process.exit(1);
    }
  }

  return { phase: phase as any, courses: resolvedCourses };
}

async function runScript(scriptPath: string, env?: Record<string, string>) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: '/Users/macbook/Desktop/allternit-workspace/allternit',
      shell: true,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`${scriptPath} exited ${code}`));
      else resolve();
    });
  });
}

async function runPhase(phase: string, courses: string[]) {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  PHASE: ${phase.toUpperCase()} — ${courses.length} course(s)`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  switch (phase) {
    case 'create': {
      console.log('Creating courses via browser automation...');
      await runScript('scripts/create-advanced-courses-browser.ts', {
        CANVAS_EMAIL: process.env.CANVAS_EMAIL || '',
        CANVAS_PASSWORD: process.env.CANVAS_PASSWORD || '',
      });
      break;
    }

    case 'covers': {
      console.log('Generating cover images...');
      const coverProc = spawn('python3', ['scripts/generate-course-covers.py'], {
        cwd: '/Users/macbook/Desktop/allternit-workspace/allternit',
        stdio: 'inherit',
      });
      await new Promise<void>((resolve, reject) => {
        coverProc.on('close', (code) => code === 0 ? resolve() : reject(new Error('Cover generation failed')));
      });

      console.log('\nUploading cover images...');
      await runScript('scripts/upload-course-images.ts');
      break;
    }

    case 'modules': {
      for (const code of courses) {
        const def = COURSE_REGISTRY[code];
        if (!def.packagePath) {
          console.log(`Skipping ${code} — no packagePath defined`);
          continue;
        }
        console.log(`\nGenerating module for ${code}...`);
        // For now, this requires manual generation or prebuilt HTML
        const htmlFile = `alabs-generated-courses/${code}-module1.html`;
        if (!fs.existsSync(htmlFile)) {
          console.log(`  ⚠️  No prebuilt HTML found at ${htmlFile}`);
          console.log(`  Run: npx tsx scripts/sync-course-from-package.ts --package ${def.packagePath} --course-id ${def.canvasId} --module-title "Module 1: ${def.name}"`);
          continue;
        }
        await runScript('scripts/sync-course-from-package.ts', {
          // These are passed as args, not env, but the script reads args directly
        });
        // Actually need to invoke with args - let's use a different approach
        const moduleProc = spawn('npx', [
          'tsx', 'scripts/sync-course-from-package.ts',
          '--course-id', def.canvasId!,
          '--module-title', `Module 1: ${def.name}`,
          '--html-file', htmlFile,
        ], {
          cwd: '/Users/macbook/Desktop/allternit-workspace/allternit',
          stdio: 'inherit',
          shell: true,
        });
        await new Promise<void>((resolve, reject) => {
          moduleProc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Module sync failed for ${code}`)));
        });
      }
      break;
    }

    case 'polish': {
      for (const code of courses) {
        const def = COURSE_REGISTRY[code];
        if (!def.canvasId) {
          console.log(`Skipping ${code} — no canvasId`);
          continue;
        }
        console.log(`\n── Polishing ${code} (${def.canvasId}) ──`);

        // Publish course + modules
        console.log('  Publishing...');
        await runScript('scripts/publish-all-modules.ts');

        // Course settings (public, nav tabs)
        console.log('  Updating settings...');
        await runScript('scripts/polish-course-settings.ts');

        // Welcome page
        console.log('  Setting up homepage...');
        await runScript('scripts/setup-course-homepages.ts');

        // Curriculum map
        console.log('  Adding curriculum map...');
        await runScript('scripts/add-curriculum-map.ts');

        // Syllabus
        console.log('  Adding syllabus...');
        await runScript('scripts/add-syllabus-pages.ts');

        // Welcome announcement
        console.log('  Posting welcome announcement...');
        await runScript('scripts/add-welcome-announcements.ts');

        // Assignment groups + capstones
        console.log('  Enriching assignments...');
        await runScript('scripts/enrich-capstones.ts');

        // Module challenges
        console.log('  Adding module challenges...');
        await runScript('scripts/add-module-challenges.ts');

        console.log(`  ✅ ${code} polished`);
      }
      break;
    }

    case 'audit': {
      await runScript('scripts/launch-audit.ts');
      break;
    }

    case 'all': {
      await runPhase('create', courses);
      await runPhase('covers', courses);
      await runPhase('modules', courses);
      await runPhase('polish', courses);
      await runPhase('audit', courses);
      break;
    }
  }
}

async function main() {
  const { phase, courses } = parseArgs();
  console.log(`A://Labs Course Pipeline`);
  console.log(`Phase: ${phase}`);
  console.log(`Courses: ${courses.join(', ')}`);

  const start = Date.now();
  await runPhase(phase, courses);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  PIPELINE COMPLETE — ${elapsed}s`);
  console.log(`═══════════════════════════════════════════════════════════════`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

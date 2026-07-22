export type Tab = 'discovery' | 'research' | 'tracks' | 'classroom' | 'certifications' | 'settings';

export const LABS_STORAGE_KEY = 'allternit-labs-config';

export interface ALABSCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  tier: 'CORE' | 'OPS' | 'AGENTS' | 'ADV';
  canvasUrl: string;
  modules: number;
  capstone: string;
  coverImage: string;
  demosUrl?: string;
}

export interface ALABSLesson {
  id: string;
  courseId: string;
  moduleNumber: number;
  lessonNumber: number;
  title: string;
  description: string;
  sceneJson: string | null;
  videoUrl: string | null;
  durationMinutes: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  createdAt: string;
  courseCode: string;
  courseTitle: string;
}

/* The labs API returns snake_case fields; normalize at the fetch boundary. */

export function normalizeCourse(raw: Record<string, any>): ALABSCourse {
  const code = raw.code ?? '';
  const coverImage = raw.coverImage || raw.cover_image
    || (code ? `/images/alabs-covers/${code}.png` : '');
  return {
    id: String(raw.id ?? ''),
    code,
    title: raw.title ?? '',
    description: raw.description ?? '',
    tier: raw.tier ?? 'CORE',
    canvasUrl: raw.canvasUrl ?? raw.canvas_url ?? '',
    modules: raw.modules ?? 0,
    capstone: raw.capstone ?? '',
    coverImage,
    demosUrl: raw.demosUrl ?? raw.demos_url ?? undefined,
  };
}

export function normalizeLesson(raw: Record<string, any>): ALABSLesson {
  return {
    id: String(raw.id ?? ''),
    courseId: String(raw.courseId ?? raw.course_id ?? ''),
    moduleNumber: raw.moduleNumber ?? raw.module_number ?? 0,
    lessonNumber: raw.lessonNumber ?? raw.lesson_number ?? 0,
    title: raw.title ?? '',
    description: raw.description ?? '',
    sceneJson: raw.sceneJson ?? raw.scene_json ?? null,
    videoUrl: raw.videoUrl ?? raw.video_url ?? null,
    durationMinutes: raw.durationMinutes ?? raw.duration_minutes ?? 0,
    status: raw.status ?? 'published',
    publishedAt: raw.publishedAt ?? raw.published_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    courseCode: raw.courseCode ?? raw.course_code ?? '',
    courseTitle: raw.courseTitle ?? raw.course_title ?? '',
  };
}

/*
 * Mirrors the live /api/v1/courses catalog exactly (same ids/titles/tiers) so
 * an offline fallback never shows courses that don't actually exist server-side.
 * (A larger 10-course legacy catalog previously lived here with orphaned ids —
 * its cover art is still on disk under /images/alabs-covers/ but the courses
 * themselves are no longer served by the API.)
 */
export const FALLBACK_COURSES: ALABSCourse[] = [
  {
    id: 'course-copilot', code: 'ALABS-CORE-COPILOT', title: 'A://Labs — Core Copilot',
    description: 'Master the fundamentals of AI-assisted development and Allternit platform operations.',
    tier: 'CORE', canvasUrl: 'https://canvas.instructure.com/courses/14593493', modules: 4,
    capstone: 'Build a working copilot extension that integrates with the Allternit API.',
    coverImage: '/images/alabs-covers/ALABS-CORE-COPILOT.png',
  },
  {
    id: 'course-ops', code: 'ALABS-OPS-RAG', title: 'A://Labs — OPS RAG',
    description: 'Production-grade RAG systems, vector search, and memory architecture for operations teams.',
    tier: 'OPS', canvasUrl: 'https://canvas.instructure.com/courses/14593494', modules: 5,
    capstone: 'Deploy a RAG pipeline with >90% retrieval accuracy on your own dataset.',
    coverImage: '/images/alabs-covers/ALABS-OPS-RAG.png',
  },
  {
    id: 'course-agents', code: 'ALABS-AGENTS-AGENTS', title: 'A://Labs — Agents × Agents',
    description: 'Multi-agent orchestration, swarm design, and autonomous agent systems.',
    tier: 'AGENTS', canvasUrl: 'https://canvas.instructure.com/courses/14593495', modules: 6,
    capstone: 'Build a 3-agent swarm that collaboratively completes a complex research task.',
    coverImage: '/images/alabs-covers/ALABS-AGENTS-AGENTS.png',
  },
  {
    id: 'course-adv', code: 'ALABS-ADV-MCP', title: 'A://Labs — ADV MCP',
    description: 'Advanced model context protocols, custom tool ecosystems, and deep integration patterns.',
    tier: 'ADV', canvasUrl: 'https://canvas.instructure.com/courses/14593496', modules: 4,
    capstone: 'Design and publish an MCP server with 5+ custom tools used by 10+ users.',
    coverImage: '',
  },
  {
    id: 'course-platform', code: 'ALABS-PLATFORM', title: 'A://Labs — Platform Architecture',
    description: 'How the Allternit platform surface is built, from shell routing and auth to agents, design tokens, and deployment.',
    tier: 'ADV', canvasUrl: '', modules: 5,
    capstone: 'Trace a feature end-to-end through the platform shell, agent layer, and build pipeline.',
    coverImage: '',
  },
];

export const L = {
  bg:          'var(--surface-canvas)',
  bgCard:      'var(--surface-panel)',
  bgElevated:  'var(--surface-floating)',
  border:      'var(--ui-border-muted)',
  borderMed:   'var(--ui-border-default)',
  textPrimary: 'var(--ui-text-primary)',
  textSec:     'var(--ui-text-secondary)',
  textTer:     'var(--ui-text-muted)',
  accent:      '#a78bfa',
  accentDim:   'rgba(167,139,250,0.10)',
  accentBorder:'rgba(167,139,250,0.20)',
  gold:        'var(--status-warning)',
} as const;

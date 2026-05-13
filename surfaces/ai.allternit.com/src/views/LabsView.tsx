/**
 * A://Labs View — Learning Portal
 *
 * Production-quality learning portal using the Allternit design system:
 * - GlassCard / GlassSurface for all surfaces
 * - Text typography component for all type
 * - Fade / Stagger for entry animations
 * - Real course cover imagery, no generative fallbacks
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  Settings,
  Play,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  Eye,
  GraduationCap,
  Globe,
  Layers,
  BarChart3,
  Rocket,
  Award,
  FlaskConical,
  Compass,
  School,
  Clock,
  FileText,
  MonitorPlay,
  ChevronRight,
} from 'lucide-react';
import { useNav } from '@/nav/useNav';
import { CertificationsPanel } from './CertificationsPanel';
import { ResearchTab } from './research/ResearchTab';
import { DiscoveryFeed } from './discovery/DiscoveryFeed';
import { notebookApi } from './research/hooks/useNotebookApi';

import { GlassCard, GlassCardInteractive } from '@/design/glass/GlassCard';
import { GlassSurface, GlassSurfaceThin, GlassSurfaceBase } from '@/design/glass/GlassSurface';
import { Fade } from '@/design/animation/Fade';
import { Stagger } from '@/design/animation/Stagger';
import { Text } from '@/components/typography/Text';
import { LessonPlayer } from './labs/components/LessonPlayer';
import { LessonPlayerErrorBoundary } from './labs/components/LessonPlayerErrorBoundary';
import { cn } from '@/lib/utils';

type Tab = 'discovery' | 'research' | 'tracks' | 'classroom' | 'certifications' | 'settings';

const LABS_STORAGE_KEY = 'allternit-labs-config';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ALABSCourse {
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

interface ALABSLesson {
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

// ─── Fallback Data ───────────────────────────────────────────────────────────

const FALLBACK_COURSES: ALABSCourse[] = [
  {
    id: '14593493', code: 'ALABS-CORE-COPILOT', title: 'Build AI-Assisted Software with Copilot & Cursor',
    description: 'Learn to use GitHub Copilot and Cursor as infrastructure layers for code generation, refactoring, and MCP tool building.',
    tier: 'CORE', canvasUrl: 'https://canvas.instructure.com/courses/14593493', modules: 7,
    capstone: 'Build a TypeScript MCP Server with Cursor', coverImage: '/images/alabs-covers/ALABS-CORE-COPILOT.png',
  },
  {
    id: '14593495', code: 'ALABS-CORE-PROMPTS', title: 'Prompt Engineering & Systematic LLM Reasoning',
    description: 'Master prompt engineering from first principles: systematic prompting, Python API patterns, and red-teaming.',
    tier: 'CORE', canvasUrl: 'https://canvas.instructure.com/courses/14593495', modules: 7,
    capstone: 'Design a 3-Prompt Suite + Red-Team Report', coverImage: '/images/alabs-covers/ALABS-CORE-PROMPTS.png',
  },
  {
    id: '14593499', code: 'ALABS-OPS-N8N', title: 'Orchestrate Agents & Automations with n8n',
    description: 'Build production business workflows with n8n: architecture, patterns, OpenAI agent nodes, and self-hosted scaling.',
    tier: 'OPS', canvasUrl: 'https://canvas.instructure.com/courses/14593499', modules: 8,
    capstone: 'Build a Self-Hosted n8n MCP Workflow', coverImage: '/images/alabs-covers/ALABS-OPS-N8N.png',
  },
  {
    id: '14593501', code: 'ALABS-OPS-VISION', title: 'Computer Vision for Agent Systems',
    description: 'Connect OpenCV and vision models to agent systems. Feature detection, object tracking, and screen-state analysis.',
    tier: 'OPS', canvasUrl: 'https://canvas.instructure.com/courses/14593501', modules: 6,
    capstone: 'Build a Screen-State Analyzer for LLM Agents', coverImage: '/images/alabs-covers/ALABS-OPS-VISION.png',
  },
  {
    id: '14593503', code: 'ALABS-OPS-RAG', title: 'Local RAG & Document Intelligence',
    description: 'Build privacy-preserving RAG pipelines with local LLMs, semantic search, and offline document Q&A agents.',
    tier: 'OPS', canvasUrl: 'https://canvas.instructure.com/courses/14593503', modules: 7,
    capstone: 'Offline Document-QA Agent', coverImage: '/images/alabs-covers/ALABS-OPS-RAG.png',
  },
  {
    id: '14593505', code: 'ALABS-AGENTS-ML', title: 'ML Models as Agent Tools',
    description: 'When to use ML vs. LLMs vs. rules. Wrap scikit-learn models as MCP tools and integrate them into agent workflows.',
    tier: 'AGENTS', canvasUrl: 'https://canvas.instructure.com/courses/14593505', modules: 6,
    capstone: 'Wrap a Scikit-Learn Model as an MCP Tool', coverImage: '/images/alabs-covers/ALABS-AGENTS-ML.png',
  },
  {
    id: '14593507', code: 'ALABS-AGENTS-AGENTS', title: 'Multi-Agent Systems & Orchestration',
    description: 'Design collaborative agent swarms: tool-using agents, code-generation agents, and multi-agent orchestration patterns.',
    tier: 'AGENTS', canvasUrl: 'https://canvas.instructure.com/courses/14593507', modules: 7,
    capstone: 'Design a 3-Agent Collaborative Blog-Writing System', coverImage: '/images/alabs-covers/ALABS-AGENTS-AGENTS.png',
  },
  {
    id: '14612851', code: 'ALABS-ADV-PLUGINSDK', title: 'Build Plugins for Allternit',
    description: 'Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, publishing, and production integration.',
    tier: 'ADV', canvasUrl: 'https://canvas.instructure.com/courses/14612851', modules: 4,
    capstone: 'Build a Cross-Platform Plugin with PluginHost', coverImage: '/images/alabs-covers/ALABS-ADV-PLUGINSDK.png',
    demosUrl: '/demos/ALABS-ADV-PLUGINSDK-module1.html',
  },
  {
    id: '14612861', code: 'ALABS-ADV-WORKFLOW', title: 'The Allternit Workflow Engine',
    description: 'Visual DAG orchestration, scheduler, execution model, and production workflow integration.',
    tier: 'ADV', canvasUrl: 'https://canvas.instructure.com/courses/14612861', modules: 3,
    capstone: 'Build a Custom Workflow Node', coverImage: '/images/alabs-covers/ALABS-ADV-WORKFLOW.png',
    demosUrl: '/demos/ALABS-ADV-WORKFLOW-module1.html',
  },
  {
    id: '14612869', code: 'ALABS-ADV-ADAPTERS', title: 'Provider Adapters & Unified APIs',
    description: 'Abstraction layers, rate limiting, resilience patterns, failover, and production API integration.',
    tier: 'ADV', canvasUrl: 'https://canvas.instructure.com/courses/14612869', modules: 3,
    capstone: 'Build a Provider Adapter for a New API', coverImage: '/images/alabs-covers/ALABS-ADV-ADAPTERS.png',
    demosUrl: '/demos/ALABS-ADV-ADAPTERS-module1.html',
  },
];

// ─── Design Tokens ───────────────────────────────────────────────────────────

const L = {
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

// ─── Utilities ───────────────────────────────────────────────────────────────

function getTierColor(tier: string) {
  switch (tier) {
    case 'CORE': return 'var(--status-info)';
    case 'OPS': return '#8b5cf6';
    case 'AGENTS': return '#ec4899';
    case 'ADV': return 'var(--status-warning)';
    default: return 'var(--ui-text-muted)';
  }
}

function getTierIcon(tier: string) {
  switch (tier) {
    case 'CORE': return Layers;
    case 'OPS': return BarChart3;
    case 'AGENTS': return Rocket;
    case 'ADV': return GraduationCap;
    default: return GraduationCap;
  }
}

function useLabsReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity .68s cubic-bezier(.16,1,.3,1), transform .68s cubic-bezier(.16,1,.3,1)';
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        obs.disconnect();
      }
    }, { threshold: 0.07 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// ─── Components ──────────────────────────────────────────────────────────────

function StatPill({ value, label, icon: Icon, color }: { value: string; label: string; icon: React.ElementType; color: string }) {
  return (
    <GlassSurfaceThin
      className="flex items-center gap-3 p-2.5 px-4 min-w-[140px]"
    >
      <div 
        className="size-8 rounded-lg flex items-center justify-center shrink-0 border border-solid"
        style={{ background: `${color}18`, borderColor: `${color}30` }}
      >
        <Icon size={15} color={color} />
      </div>
      <div>
        <Text variant="heading" className="text-xl font-extrabold leading-none block" style={{ color }}>{value}</Text>
        <Text variant="label" className="text-[12px] font-bold tracking-[0.12em] uppercase text-[var(--ui-text-muted)] mt-0.5 block">{label}</Text>
      </div>
    </GlassSurfaceThin>
  );
}

function TierBadge({ tier, color }: { tier: string; color: string }) {
  const TierIcon = getTierIcon(tier);
  return (
    <GlassSurfaceThin
      className="flex items-center gap-1.5 p-1 px-2.5 rounded-full border border-solid"
      style={{ background: `${color}14`, borderColor: `${color}30` }}
    >
      <TierIcon size={11} color={color} />
      <Text variant="label" className="text-[12px] font-extrabold tracking-[0.12em] uppercase" style={{ color }}>{tier}</Text>
    </GlassSurfaceThin>
  );
}

function CourseCard({ course, tierColor, canvasToken, onOpenNotebook, onSyncCanvas }: {
  course: ALABSCourse;
  tierColor: string;
  canvasToken: string;
  onOpenNotebook: () => void;
  onSyncCanvas: () => void;
}) {
  const ref = useLabsReveal<HTMLDivElement>();
  const TierIcon = getTierIcon(course.tier);

  return (
    <div ref={ref}>
      <GlassCardInteractive
        hover="lift"
        elevation="raised"
        border="subtle"
        blur="md"
        className="overflow-hidden flex flex-col h-full"
      >
        {/* Cover image */}
        <div className="relative h-40 shrink-0 overflow-hidden group">
          <img
            src={course.coverImage}
            alt={course.title}
            className="size-full object-cover block transition-transform duration-500 ease-out group-hover:scale-110"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
          <div className="absolute top-3 left-3">
            <TierBadge tier={course.tier} color={tierColor} />
          </div>
          <div className="absolute top-3 right-3">
            <Text variant="label" className="text-[12px] font-bold text-white/45 tracking-wider">{course.modules} modules</Text>
          </div>
          <div className="absolute bottom-3 left-3.5">
            <Text variant="label" className="text-[12px] font-extrabold tracking-widest uppercase" style={{ color: `${tierColor}bb` }}>{course.code}</Text>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col">
          <Text variant="researchHeading" as="h3" className="text-[17px] font-black italic m-0 mb-2.5 tracking-tight leading-snug text-[var(--ui-text-primary)]">
            {course.title}
          </Text>

          <Text variant="body" className="text-[13px] text-[var(--ui-text-secondary)] m-0 mb-4 leading-relaxed line-clamp-3">
            {course.description}
          </Text>

          {/* Capstone box */}
          <GlassSurfaceThin 
            className="p-3 px-4 mb-4 rounded-xl border border-solid transition-colors"
            style={{ background: `${tierColor}0a`, borderColor: `${tierColor}20` }}
          >
            <Text variant="label" className="text-[12px] font-black tracking-widest uppercase mb-1 block" style={{ color: tierColor }}>Capstone</Text>
            <Text variant="body" className="text-[12px] text-[var(--ui-text-primary)] leading-relaxed">{course.capstone}</Text>
          </GlassSurfaceThin>

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={onOpenNotebook}
                className="flex-1 flex items-center justify-center gap-1.5 p-2 px-3.5 rounded-lg border-none text-[var(--ui-text-primary)] font-bold text-[12.5px] cursor-pointer transition-all active:scale-95 shadow-lg"
                style={{ background: `linear-gradient(135deg,${tierColor},${tierColor}bb)`, boxShadow: `0 4px 14px ${tierColor}30` }}
              >
                <BookOpen size={13} /> Open Notebook
              </button>
              <a href={course.canvasUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center p-2 px-3 rounded-lg bg-white/5 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] no-underline transition-colors hover:bg-white/10"
                title="Open in Canvas"
              >
                <ExternalLink size={13} />
              </a>
            </div>
            <div className="flex gap-2">
              {canvasToken && (
                <button onClick={onSyncCanvas}
                  className="flex-1 flex items-center justify-center gap-1.5 p-2 px-3.5 rounded-lg bg-white/5 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer text-[12px] font-semibold transition-colors hover:bg-white/10"
                >
                  <RefreshCw size={12} /> Sync Canvas
                </button>
              )}
              {course.demosUrl && (
                <a href={course.demosUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 p-2 px-3.5 rounded-lg bg-white/5 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] no-underline text-[12px] font-semibold transition-colors hover:bg-white/10"
                >
                  <Eye size={12} /> Try Demo
                </a>
              )}
            </div>
          </div>
        </div>
      </GlassCardInteractive>
    </div>
  );
}

function LessonCard({ lesson, onClick }: { lesson: ALABSLesson; onClick?: () => void }) {
  const ref = useLabsReveal<HTMLDivElement>();
  return (
    <div ref={ref}>
      <GlassCardInteractive
        hover="lift"
        elevation="raised"
        border="subtle"
        blur="md"
        onClick={onClick}
        className="flex items-center gap-4 p-4 px-5"
      >
        <div 
          className="size-11 rounded-xl flex items-center justify-center shrink-0 border border-solid"
          style={{ background: `${L.accent}14`, borderColor: `${L.accent}28` }}
        >
          {lesson.videoUrl ? <MonitorPlay size={18} color={L.accent} /> : <FileText size={18} color={L.accent} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Text variant="label" className="text-[12px] font-extrabold tracking-wider uppercase text-[var(--accent-primary)]">
              M{lesson.moduleNumber} · L{lesson.lessonNumber}
            </Text>
            {lesson.durationMinutes > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-[var(--ui-text-muted)]" />
                <Text variant="caption" className="text-[12px] text-[var(--ui-text-muted)]">{lesson.durationMinutes} min</Text>
              </div>
            )}
          </div>
          <Text variant="subheading" className="text-[14px] font-bold text-[var(--ui-text-primary)] mb-0.5 block">
            {lesson.title}
          </Text>
          {lesson.description && (
            <Text variant="body" className="text-[12px] text-[var(--ui-text-secondary)] leading-relaxed truncate block">
              {lesson.description}
            </Text>
          )}
        </div>
        <ChevronRight size={16} className="text-[var(--ui-text-muted)] shrink-0" />
      </GlassCardInteractive>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function LabsView() {
  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('https://canvas.instructure.com');
  const [notification, setNotification] = useState<string | null>(null);
  const [courses, setCourses] = useState<ALABSCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [lessons, setLessons] = useState<ALABSLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<ALABSLesson | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);

  // Load courses from API on mount
  useEffect(() => {
    fetch('/api/v1/courses')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`[LabsView] Failed to load courses: ${res.status}`, body);
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: ALABSCourse[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCourses(data);
        } else {
          setCourses(FALLBACK_COURSES);
        }
        setCoursesLoading(false);
      })
      .catch((err) => {
        console.error('[LabsView] Could not fetch courses:', err);
        showNotification('Course catalog unavailable — showing defaults');
        setCourses(FALLBACK_COURSES);
        setCoursesLoading(false);
      });
  }, []);

  // Load lessons from API on mount
  useEffect(() => {
    fetch('/api/v1/lessons?status=published')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`[LabsView] Failed to load lessons: ${res.status}`, body);
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: ALABSLesson[] | { error: string }) => {
        if (Array.isArray(data)) {
          setLessons(data);
        } else {
          setLessons([]);
        }
        setLessonsLoading(false);
      })
      .catch((err) => {
        console.error('[LabsView] Could not fetch lessons:', err);
        showNotification('Lesson catalog unavailable');
        setLessons([]);
        setLessonsLoading(false);
      });
  }, []);

  // Load Canvas config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LABS_STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setCanvasToken(config.canvasToken || '');
        setCanvasDomain(config.canvasDomain || 'https://canvas.instructure.com');
      } catch (err) {
        console.error('[LabsView] Malformed Canvas config in localStorage:', err);
      }
    }
  }, []);

  // Listen for Discovery → Research navigation
  useEffect(() => {
    const handler = (e: CustomEvent<{ notebookId?: string }>) => {
      setActiveTab('research');
      if (e.detail?.notebookId) {
        window.dispatchEvent(new CustomEvent('allternit:research-open-notebook', {
          detail: { notebookId: e.detail.notebookId }
        }));
      }
    };
    window.addEventListener('allternit:open-research-notebook' as any, handler);
    return () => window.removeEventListener('allternit:open-research-notebook' as any, handler);
  }, []);

  // Listen for ShellRail → Research navigation
  useEffect(() => {
    const handler = () => {
      setActiveTab('research');
    };
    window.addEventListener('allternit:open-labs-research' as any, handler);
    return () => window.removeEventListener('allternit:open-labs-research' as any, handler);
  }, []);

  const saveConfig = useCallback((config: { canvasToken?: string; canvasDomain?: string }) => {
    const current = JSON.parse(localStorage.getItem(LABS_STORAGE_KEY) || '{}');
    localStorage.setItem(LABS_STORAGE_KEY, JSON.stringify({ ...current, ...config }));
    if (config.canvasToken !== undefined) setCanvasToken(config.canvasToken);
    if (config.canvasDomain !== undefined) setCanvasDomain(config.canvasDomain);
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Open course-linked notebook
  const openCourseNotebook = useCallback(async (course: ALABSCourse) => {
    try {
      await notebookApi.health();
    } catch {
      showNotification('Research engine is offline. Starting it up...');
      // @ts-ignore
      if (window.allternit?.research?.start) {
        // @ts-ignore
        await window.allternit.research.start();
      }
    }

    try {
      const existing = localStorage.getItem(`course-notebook-${course.id}`);
      let notebookId: string;

      if (existing) {
        notebookId = existing;
        const notebooks = await notebookApi.listNotebooks();
        const found = notebooks.find(n => n.id === notebookId);
        if (!found) {
          localStorage.removeItem(`course-notebook-${course.id}`);
          notebookId = await createCourseNotebook(course);
        }
      } else {
        notebookId = await createCourseNotebook(course);
      }

      setActiveTab('research');
      window.dispatchEvent(new CustomEvent('allternit:research-open-notebook', {
        detail: { notebookId },
      }));
    } catch (err: any) {
      showNotification(`Failed to open notebook: ${err.message}`);
    }
  }, [showNotification]);

  async function syncCanvasForCourse(course: ALABSCourse) {
    if (!canvasToken || !course.canvasUrl) {
      showNotification('Canvas token not configured. Add it in Settings.');
      return;
    }
    const courseIdMatch = course.canvasUrl.match(/\/courses\/(\d+)/);
    if (!courseIdMatch) {
      showNotification('Invalid Canvas URL');
      return;
    }
    const notebookId = localStorage.getItem(`course-notebook-${course.id}`);
    if (!notebookId) {
      showNotification('No notebook found for this course. Open notebook first.');
      return;
    }
    try {
      const result = await notebookApi.canvasSync(
        notebookId,
        courseIdMatch[1],
        canvasToken,
        canvasDomain
      );
      showNotification(`Synced ${result.sources_created} Canvas sources`);
    } catch (err: any) {
      showNotification(`Canvas sync failed: ${err.message}`);
    }
  }

  async function createCourseNotebook(course: ALABSCourse): Promise<string> {
    const notebook = await notebookApi.createNotebook(
      course.title,
      `${course.code} • ${course.tier} tier • ${course.modules} modules`
    );
    const notebookId = notebook.id;
    localStorage.setItem(`course-notebook-${course.id}`, notebookId);
    localStorage.setItem(`notebook-canvas-${notebookId}`, JSON.stringify({
      courseId: course.id,
      canvasUrl: course.canvasUrl,
    }));

    await notebookApi.addSource(notebookId, {
      type: 'text',
      title: `${course.code} — Course Overview`,
      content: `Course: ${course.title}\nCode: ${course.code}\nTier: ${course.tier}\nModules: ${course.modules}\nCapstone: ${course.capstone}\nDescription: ${course.description}\nCanvas URL: ${course.canvasUrl}`,
      status: 'extracted',
    });

    if (canvasToken && course.canvasUrl) {
      try {
        const courseIdMatch = course.canvasUrl.match(/\/courses\/(\d+)/);
        if (courseIdMatch) {
          const canvasCourseId = courseIdMatch[1];
          const result = await notebookApi.canvasSync(
            notebookId,
            canvasCourseId,
            canvasToken,
            canvasDomain
          );
          showNotification(`Synced ${result.sources_created} Canvas sources into notebook`);
        }
      } catch (err: any) {
        console.error('Canvas sync failed:', err);
        showNotification(`Canvas sync failed: ${err.message}`);
      }
    }

    showNotification(`Created notebook for ${course.title}`);
    return notebookId;
  }

  const tabs = [
    { id: 'discovery'      as Tab, icon: Compass,       label: 'Discovery' },
    { id: 'research'       as Tab, icon: FlaskConical,  label: 'Sources & Chat' },
    { id: 'tracks'         as Tab, icon: GraduationCap, label: 'A://Labs Tracks' },
    { id: 'classroom'      as Tab, icon: School,        label: 'Classroom' },
    { id: 'certifications' as Tab, icon: Award,         label: 'Certifications' },
    { id: 'settings'       as Tab, icon: Settings,      label: 'Settings' },
  ];

  const lessonsByCourse = lessons.reduce<Record<string, ALABSLesson[]>>((acc, lesson) => {
    if (!acc[lesson.courseId]) acc[lesson.courseId] = [];
    acc[lesson.courseId].push(lesson);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-[var(--surface-canvas)] text-[var(--ui-text-primary)] relative overflow-hidden">
      {/* Ambient grain overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.032] bg-[url('data:image/svg+xml,%3Csvg_xmlns=%27http://www.w3.org/2000/svg%27_width=%27256%27_height=%27256%27%3E%3Cfilter_id=%27g%27%3E%3CfeTurbulence_type=%27fractalNoise%27_baseFrequency=%27.72%27_numOctaves=%274%27_stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect_width=%27256%27_height=%27256%27_filter=%27url(%23g)%27/%3E%3C/svg%3E')] bg-[length:256px_256px]" />

      {/* ── Notification Toast ─────────────────────────────────────────── */}
      {notification && (
        <Fade in direction="right" distance={30}>
          <div className="fixed top-5 right-5 bg-[#0d1f17] border border-solid border-emerald-500/25 rounded-xl p-3 px-5 z-[190] shadow-2xl">
            <div className="flex items-center gap-2.5">
              <CheckCircle size={16} className="text-emerald-400" />
              <Text variant="body" className="text-[13px] text-[var(--ui-text-primary)]">{notification}</Text>
            </div>
          </div>
        </Fade>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <GlassSurface
        elevation="floating"
        blur="lg"
        border="subtle"
        className="shrink-0 relative z-[1] rounded-none border-x-none border-t-none"
      >
        {/* Ambient orbs */}
        <div className="absolute -top-[80px] right-[80px] size-[320px] bg-[radial-gradient(circle,rgba(167,139,250,0.08),transparent_70%)] blur-[10px] pointer-events-none" />
        <div className="absolute -bottom-[60px] left-[60px] size-[200px] bg-[radial-gradient(circle,rgba(245,158,11,0.05),transparent_70%)] blur-[10px] pointer-events-none" />

        {/* Title row */}
        <div className="p-7 px-9 pb-5 flex items-start justify-between relative flex-wrap gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-5 h-px bg-[var(--accent-primary)] opacity-50" />
              <Text variant="label" className="text-[12px] font-bold tracking-[0.2em] uppercase text-[var(--accent-primary)]">Learning Portal</Text>
            </div>
            <Text variant="researchDisplay" as="h1" className="text-[46px] font-black italic m-0 mb-1.5 tracking-[-0.03em] leading-none text-[var(--ui-text-primary)]">
              A://Labs
            </Text>
            <Text variant="body" className="text-[12.5px] text-[var(--ui-text-secondary)] m-0 tracking-[0.01em]">
              10 live courses · 65 modules · open-source demos
            </Text>
          </div>

          {/* Stats + CTAs */}
          <div className="flex flex-col items-end gap-4 pt-1">
            <div className="flex gap-3 flex-wrap justify-end">
              <StatPill value="65" label="Modules" icon={Layers} color={L.gold} />
              <StatPill value="10" label="Live Courses" icon={GraduationCap} color="var(--status-success)" />
              <StatPill value="51" label="Assignments" icon={CheckCircle} color={L.accent} />
            </div>
            <div className="flex gap-2.5">
              <a href="https://allternit.com/demos" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 p-2 px-[18px] rounded-[10px] bg-gradient-to-br from-[var(--status-warning)] to-[#d97706] border-none text-[var(--ui-text-inverse)] font-bold text-[13px] no-underline cursor-pointer shadow-[0_4px_16px_rgba(245,158,11,0.25)]"
              >
                <Play size={15} /> Open-Source Demos
              </a>
              <button onClick={() => dispatch({ type:'OPEN_VIEW', viewType:'catalog' })}
                className="flex items-center gap-1.5 p-2 px-[18px] rounded-[10px] bg-white/5 border border-solid border-[var(--ui-border-default)] text-[var(--ui-text-primary)] font-semibold text-[13px] cursor-pointer transition-all hover:bg-white/[0.09]"
              >
                <Globe size={15} /> Browse Free Catalog
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar — pill segment control in GlassSurface */}
        <div className="p-9 pt-0 pb-3">
          <GlassSurfaceThin
            className="inline-flex gap-1 p-1 rounded-xl"
          >
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 p-2 px-4 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap",
                    isActive 
                      ? "bg-[var(--accent-primary)]/15 text-[#f0f0f0]" 
                      : "bg-transparent text-[var(--ui-text-secondary)] hover:bg-white/5"
                  )}
                >
                  <tab.icon size={13} /> {tab.label}
                </button>
              );
            })}
          </GlassSurfaceThin>
        </div>
      </GlassSurface>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {activeTab === 'research' ? (
        <div className="flex-1 overflow-hidden min-h-0 relative z-[1]">
          <ResearchTab />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-8 px-9 relative z-[1]">

          {/* ── Discovery ── */}
          {activeTab === 'discovery' && (
            <Fade in direction="up" distance={20}>
              <DiscoveryFeed />
            </Fade>
          )}

          {/* ── Tracks ── */}
          {activeTab === 'tracks' && (
            <Fade in direction="up" distance={20}>
              <div>
                {coursesLoading && (
                  <div className="flex items-center justify-center p-12 gap-3 text-[var(--ui-text-secondary)]">
                    <RefreshCw size={20} className="animate-spin" />
                    <Text variant="body">Loading courses…</Text>
                  </div>
                )}
                <Stagger staggerDelay={0.08} direction="up" distance={20}>
                  {(['CORE','OPS','AGENTS','ADV'] as const).map(tier => {
                    const TierIcon = getTierIcon(tier);
                    const tierColor = getTierColor(tier);
                    const tierCourses = courses.filter(c => c.tier === tier);
                    if (tierCourses.length === 0) return null;
                    return (
                      <div key={tier} className="mb-[52px]">
                        {/* Tier section header */}
                        <div className="flex items-center gap-3.5 mb-5">
                          <div 
                            className="size-9 rounded-xl flex items-center justify-center shrink-0 border border-solid"
                            style={{ background: `${tierColor}14`, borderColor: `${tierColor}28` }}
                          >
                            <TierIcon size={18} color={tierColor} />
                          </div>
                          <div>
                            <Text variant="researchHeading" className="text-[22px] font-black italic text-[var(--ui-text-primary)] tracking-tight">Tier {tier}</Text>
                          </div>
                          <div 
                            className="flex-1 h-px"
                            style={{ background: `linear-gradient(to right,${tierColor}25,transparent)` }}
                          />
                          <Text variant="label" className="text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-muted)]">{tierCourses.length} courses</Text>
                        </div>

                        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                          {tierCourses.map(course => (
                            <CourseCard
                              key={course.code}
                              course={course}
                              tierColor={tierColor}
                              canvasToken={canvasToken}
                              onOpenNotebook={() => openCourseNotebook(course)}
                              onSyncCanvas={() => syncCanvasForCourse(course)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Stagger>
              </div>
            </Fade>
          )}

          {/* ── Classroom ── */}
          {activeTab === 'classroom' && (
            <Fade in direction="up" distance={20}>
              <div className="min-h-[60vh]">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-px bg-[var(--accent-primary)] opacity-50" />
                    <Text variant="label" className="text-[12.5px] font-bold tracking-widest uppercase text-[var(--accent-primary)]">Lesson Catalog</Text>
                  </div>
                  <Text variant="researchHeading" as="h2" className="text-3xl font-black italic m-0 mb-1.5 tracking-tight text-[var(--ui-text-primary)] leading-none">
                    A://Labs Classroom
                  </Text>
                  <Text variant="body" className="text-[12px] text-[var(--ui-text-secondary)] m-0 tracking-[0.01em] leading-relaxed">
                    Structured lessons across all tracks. Progress is tracked per enrollment.
                  </Text>
                </div>

                {lessonsLoading ? (
                  <div className="flex items-center justify-center p-12 gap-3 text-[var(--ui-text-secondary)]">
                    <RefreshCw size={20} className="animate-spin" />
                    <Text variant="body">Loading lessons…</Text>
                  </div>
                ) : lessons.length === 0 ? (
                  <GlassSurfaceBase className="max-w-[520px] mx-auto text-center p-12 px-9">
                    <div 
                      className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-solid"
                      style={{ background: `${L.accent}14`, borderColor: `${L.accent}28` }}
                    >
                      <School size={28} color={L.accent} />
                    </div>
                    <Text variant="researchHeading" as="h3" className="text-xl font-black italic m-0 mb-2.5 text-[var(--ui-text-primary)]">
                      No Lessons Published
                    </Text>
                    <Text variant="body" className="text-[13px] text-[var(--ui-text-secondary)] m-0 mb-5 leading-relaxed">
                      The lesson catalog is empty. Generate a lesson from any course to get started.
                    </Text>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {courses.slice(0, 5).map(course => (
                        <button
                          key={course.id}
                          onClick={async () => {
                            setGeneratingLesson(true);
                            try {
                              const res = await fetch('/api/v1/lessons/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ courseId: course.id, targetDuration: 20 }),
                              });
                              const data = await res.json();
                              if (data.lesson) {
                                setLessons(prev => [...prev, data.lesson]);
                                showNotification(`Generated lesson for ${course.title}`);
                              }
                            } catch (e) {
                              showNotification('Failed to generate lesson');
                            } finally {
                              setGeneratingLesson(false);
                            }
                          }}
                          disabled={generatingLesson}
                          className="p-2 px-3.5 rounded-lg border border-solid text-[12px] font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-wait"
                          style={{
                            background: `${getTierColor(course.tier)}12`,
                            borderColor: `${getTierColor(course.tier)}30`,
                            color: getTierColor(course.tier),
                          }}
                        >
                          {generatingLesson ? 'Generating...' : course.title}
                        </button>
                      ))}
                    </div>
                  </GlassSurfaceBase>
                ) : (
                  <div className="flex flex-col gap-8">
                    {Object.entries(lessonsByCourse).map(([courseId, courseLessons]) => {
                      const course = courses.find(c => c.id === courseId);
                      const tierColor = course ? getTierColor(course.tier) : L.accent;
                      return (
                        <div key={courseId}>
                          <div className="flex items-center gap-3.5 mb-4">
                            <div 
                              className="size-8 rounded-lg flex items-center justify-center shrink-0 border border-solid"
                              style={{ background: `${tierColor}14`, borderColor: `${tierColor}28` }}
                            >
                              {course ? React.createElement(getTierIcon(course.tier), { size: 15, color: tierColor }) : <School size={15} color={tierColor} />}
                            </div>
                            <div>
                              <Text variant="subheading" className="text-[15px] font-extrabold text-[var(--ui-text-primary)]">{course?.title ?? courseLessons[0]?.courseTitle ?? 'Unknown Course'}</Text>
                            </div>
                            <div 
                              className="flex-1 h-px"
                              style={{ background: `linear-gradient(to right,${tierColor}20,transparent)` }}
                            />
                            <Text variant="label" className="text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-muted)]">{courseLessons.length} lessons</Text>
                          </div>
                          <Stagger staggerDelay={0.04} direction="up" distance={12}>
                            {courseLessons.map(lesson => (
                              <LessonCard key={lesson.id} lesson={lesson} onClick={() => setActiveLesson(lesson)} />
                            ))}
                          </Stagger>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Fade>
          )}

          {/* ── Certifications ── */}
          {activeTab === 'certifications' && (
            <Fade in direction="up" distance={20}>
              <CertificationsPanel />
            </Fade>
          )}

          {/* ── Settings ── */}
          {activeTab === 'settings' && (
            <Fade in direction="up" distance={20}>
              <div className="max-w-[520px]">
                <div className="mb-9">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-px bg-[var(--ui-text-secondary)] opacity-40" />
                    <Text variant="label" className="text-[12.5px] font-bold tracking-widest uppercase text-[var(--ui-text-secondary)]">Configuration</Text>
                  </div>
                  <Text variant="researchHeading" as="h2" className="text-3xl font-black italic m-0 tracking-tight text-[var(--ui-text-primary)] leading-none">Settings</Text>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-2.5 mb-5">
                    <Text variant="label" className="text-[12px] font-extrabold tracking-widest uppercase text-[var(--accent-primary)]">Canvas LMS</Text>
                    <div className="flex-1 h-px bg-[var(--ui-border-muted)]" />
                  </div>
                  <div className="flex flex-col gap-4.5">
                    <div>
                      <Text variant="label" as="label" className="block text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-secondary)] mb-2">API Token</Text>
                      <input type="password" value={canvasToken}
                        onChange={e => saveConfig({ canvasToken: e.target.value })}
                        placeholder="Paste your Canvas API token here"
                        className="w-full p-2.5 px-3.5 rounded-lg border border-solid border-white/10 bg-white/[0.04] text-[#f0f0f0] text-sm outline-none transition-colors focus:border-[rgba(167,139,250,0.4)] box-border"
                      />
                      <Text variant="caption" className="text-[12px] text-[var(--ui-text-muted)] mt-1.5 leading-relaxed block">Canvas → Account → Settings → Approved Integrations → New Access Token</Text>
                    </div>
                    <div>
                      <Text variant="label" as="label" className="block text-[12px] font-bold tracking-wider uppercase text-[var(--ui-text-secondary)] mb-2">Domain</Text>
                      <input type="text" value={canvasDomain}
                        onChange={e => saveConfig({ canvasDomain: e.target.value })}
                        placeholder="https://canvas.instructure.com"
                        className="w-full p-2.5 px-3.5 rounded-lg border border-solid border-white/10 bg-white/[0.04] text-[#f0f0f0] text-sm outline-none transition-colors focus:border-[rgba(167,139,250,0.4)] box-border"
                      />
                    </div>
                  </div>
                </div>

                <GlassSurfaceThin 
                  className="p-4.5 px-5 rounded-[13px] border border-solid"
                  style={{ background: L.accentDim, borderColor: L.accentBorder }}
                >
                  <Text variant="label" className="m-0 mb-3 font-bold text-[12px] tracking-wider uppercase text-[var(--accent-primary)] flex items-center gap-1.5">
                    <Eye size={12}/> Getting Your Canvas Token
                  </Text>
                  <ol className="m-0 pl-4.5 text-[var(--ui-text-secondary)] text-[12px] leading-[2]">
                    <li>Log in to Canvas</li>
                    <li>Go to Account → Settings</li>
                    <li>Scroll to Approved Integrations</li>
                    <li>Click <em className="italic">New Access Token</em> and copy the generated value</li>
                  </ol>
                </GlassSurfaceThin>
              </div>
            </Fade>
          )}
        </div>
      )}

      {/* Lesson Player Overlay */}
      {activeLesson && (
        <LessonPlayerErrorBoundary onClose={() => setActiveLesson(null)}>
          <LessonPlayer
            lesson={activeLesson}
            onClose={() => setActiveLesson(null)}
            onProgressUpdate={(progress) => {
              if (progress >= 100) {
                showNotification(`Completed: ${activeLesson.title}`);
              }
            }}
          />
        </LessonPlayerErrorBoundary>
      )}
    </div>
  );
}

export default LabsView;

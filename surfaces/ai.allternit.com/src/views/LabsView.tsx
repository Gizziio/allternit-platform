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
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', minWidth: 140 }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
      <div>
        <Text variant="heading" style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1, display: 'block' }}>{value}</Text>
        <Text variant="label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: L.textTer, marginTop: 3, display: 'block' }}>{label}</Text>
      </div>
    </GlassSurfaceThin>
  );
}

function TierBadge({ tier, color }: { tier: string; color: string }) {
  const TierIcon = getTierIcon(tier);
  return (
    <GlassSurfaceThin
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 10px',
        background: `${color}14`,
        border: `1px solid ${color}30`,
        borderRadius: 99,
      }}
    >
      <TierIcon size={11} color={color} />
      <Text variant="label" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color }}>{tier}</Text>
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
        style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* Cover image */}
        <div style={{ position: 'relative', height: 160, flexShrink: 0, overflow: 'hidden' }}>
          <img
            src={course.coverImage}
            alt={course.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .4s cubic-bezier(.4,0,.2,1)' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 40%, rgba(14,14,14,.92) 100%)` }} />
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <TierBadge tier={course.tier} color={tierColor} />
          </div>
          <div style={{ position: 'absolute', top: 12, right: 12 }}>
            <Text variant="label" style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.06em' }}>{course.modules} modules</Text>
          </div>
          <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
            <Text variant="label" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: `${tierColor}bb` }}>{course.code}</Text>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '18px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Text variant="researchHeading" as="h3" style={{ fontSize: 17, fontWeight: 900, fontStyle: 'italic', margin: '0 0 10px', color: L.textPrimary, letterSpacing: '-.02em', lineHeight: 1.25 }}>
            {course.title}
          </Text>

          <Text variant="body" style={{ fontSize: 12.5, color: L.textSec, margin: '0 0 16px', lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {course.description}
          </Text>

          {/* Capstone box */}
          <GlassSurfaceThin style={{ padding: '10px 14px', marginBottom: 18, background: `${tierColor}0a`, border: `1px solid ${tierColor}20`, borderRadius: 10 }}>
            <Text variant="label" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: tierColor, marginBottom: 5, display: 'block' }}>Capstone</Text>
            <Text variant="body" style={{ fontSize: 12, color: L.textPrimary, lineHeight: 1.4 }}>{course.capstone}</Text>
          </GlassSurfaceThin>

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onOpenNotebook}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', background: `linear-gradient(135deg,${tierColor},${tierColor}bb)`, border: 'none', borderRadius: 9, color: 'var(--ui-text-primary)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: `0 4px 14px ${tierColor}30` }}
              >
                <BookOpen size={13} /> Open Notebook
              </button>
              <a href={course.canvasUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px 12px', background: 'rgba(255,255,255,.04)', border: `1px solid ${L.border}`, borderRadius: 9, color: L.textSec, textDecoration: 'none', transition: 'background .18s' }}
                title="Open in Canvas"
              >
                <ExternalLink size={13} />
              </a>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {canvasToken && (
                <button onClick={onSyncCanvas}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,.04)', border: `1px solid ${L.border}`, borderRadius: 9, color: L.textSec, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'background .18s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                >
                  <RefreshCw size={12} /> Sync Canvas
                </button>
              )}
              {course.demosUrl && (
                <a href={course.demosUrl} target="_blank" rel="noopener noreferrer"
                  style={{ flex: canvasToken ? 0 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,.04)', border: `1px solid ${L.border}`, borderRadius: 9, color: L.textSec, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
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
        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${L.accent}14`,
          border: `1px solid ${L.accent}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {lesson.videoUrl ? <MonitorPlay size={18} color={L.accent} /> : <FileText size={18} color={L.accent} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text variant="label" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: L.accent }}>
              M{lesson.moduleNumber} · L{lesson.lessonNumber}
            </Text>
            {lesson.durationMinutes > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} color={L.textTer} />
                <Text variant="caption" style={{ color: L.textTer }}>{lesson.durationMinutes} min</Text>
              </div>
            )}
          </div>
          <Text variant="subheading" style={{ fontSize: 14, fontWeight: 700, color: L.textPrimary, marginBottom: 3, display: 'block' }}>
            {lesson.title}
          </Text>
          {lesson.description && (
            <Text variant="body" style={{ fontSize: 12, color: L.textSec, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lesson.description}
            </Text>
          )}
        </div>
        <ChevronRight size={16} color={L.textTer} style={{ flexShrink: 0 }} />
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
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: L.bg,
      color: L.textPrimary,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        opacity: .032,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px',
      }} />

      {/* ── Notification Toast ─────────────────────────────────────────── */}
      {notification && (
        <Fade in direction="right" distance={30}>
          <div style={{ position:'fixed', top:20, right:20, background:'#0d1f17', border:'1px solid rgba(52,211,153,.25)', borderRadius:12, padding:'12px 20px', zIndex:190, boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <CheckCircle size={16} color="#34d399" />
              <Text variant="body" style={{ fontSize:13, color:'var(--ui-text-primary)' }}>{notification}</Text>
            </div>
          </div>
        </Fade>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <GlassSurface
        elevation="floating"
        blur="lg"
        border="subtle"
        style={{ flexShrink: 0, position: 'relative', zIndex: 1, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
      >
        {/* Ambient orbs */}
        <div style={{ position:'absolute', top:-80, right:80, width:320, height:320, background:'radial-gradient(circle,rgba(167,139,250,.08),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, left:60, width:200, height:200, background:'radial-gradient(circle,rgba(245,158,11,.05),transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }}/>

        {/* Title row */}
        <div style={{ padding:'28px 36px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', position:'relative', flexWrap:'wrap', gap: 20 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
              <div style={{ width:20, height:1, background:L.accent, opacity:.5 }}/>
              <Text variant="label" style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:L.accent }}>Learning Portal</Text>
            </div>
            <Text variant="researchDisplay" as="h1" style={{ fontSize:46, fontWeight:900, fontStyle:'italic', margin:'0 0 6px', letterSpacing:'-.03em', lineHeight:1, color:L.textPrimary }}>
              A://Labs
            </Text>
            <Text variant="body" style={{ fontSize:12.5, color:L.textSec, margin:0, letterSpacing:'.01em' }}>
              10 live courses · 65 modules · open-source demos
            </Text>
          </div>

          {/* Stats + CTAs */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:16, paddingTop:4 }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'flex-end' }}>
              <StatPill value="65" label="Modules" icon={Layers} color={L.gold} />
              <StatPill value="10" label="Live Courses" icon={GraduationCap} color="var(--status-success)" />
              <StatPill value="51" label="Assignments" icon={CheckCircle} color={L.accent} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <a href="https://allternit.com/demos" target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:`linear-gradient(135deg,${L.gold},#d97706)`, border:'none', borderRadius:10, color:'var(--ui-text-inverse)', fontWeight:700, fontSize:13, textDecoration:'none', cursor:'pointer', boxShadow:`0 4px 16px rgba(245,158,11,.25)` }}
              >
                <Play size={15} /> Open-Source Demos
              </a>
              <button onClick={() => dispatch({ type:'OPEN_VIEW', viewType:'catalog' })}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:'rgba(255,255,255,.05)', border:`1px solid ${L.borderMed}`, borderRadius:10, color:L.textPrimary, fontWeight:600, fontSize:13, cursor:'pointer', transition:'all .18s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.09)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.05)';}}
              >
                <Globe size={15} /> Browse Free Catalog
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar — pill segment control in GlassSurface */}
        <div style={{ padding: '0 36px 12px' }}>
          <GlassSurfaceThin
            style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12 }}
          >
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? 'rgba(167,139,250,.15)' : 'transparent',
                    color: isActive ? '#f0f0f0' : L.textSec,
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all .18s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.04)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
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
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative', zIndex: 1 }}>
          <ResearchTab />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', position: 'relative', zIndex: 1 }}>

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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, color: L.textSec }}>
                    <RefreshCw size={20} className="animate-spin" />
                    <Text variant="body">Loading courses...</Text>
                  </div>
                )}
                <Stagger staggerDelay={0.08} direction="up" distance={20}>
                  {(['CORE','OPS','AGENTS','ADV'] as const).map(tier => {
                    const TierIcon = getTierIcon(tier);
                    const tierColor = getTierColor(tier);
                    const tierCourses = courses.filter(c => c.tier === tier);
                    if (tierCourses.length === 0) return null;
                    return (
                      <div key={tier} style={{ marginBottom: 52 }}>
                        {/* Tier section header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${tierColor}14`, border: `1px solid ${tierColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <TierIcon size={18} color={tierColor} />
                          </div>
                          <div>
                            <Text variant="researchHeading" style={{ fontSize: 22, fontWeight: 900, fontStyle: 'italic', color: L.textPrimary, letterSpacing: '-.02em' }}>Tier {tier}</Text>
                          </div>
                          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right,${tierColor}25,transparent)` }}/>
                          <Text variant="label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: L.textTer }}>{tierCourses.length} courses</Text>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
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
              <div style={{ minHeight: '60vh' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 16, height: 1, background: L.accent, opacity: .5 }}/>
                    <Text variant="label" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: L.accent }}>Lesson Catalog</Text>
                  </div>
                  <Text variant="researchHeading" as="h2" style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', margin: '0 0 6px', letterSpacing: '-.025em', color: L.textPrimary, lineHeight: 1 }}>
                    A://Labs Classroom
                  </Text>
                  <Text variant="body" style={{ fontSize: 12, color: L.textSec, margin: 0, letterSpacing: '.01em', lineHeight: 1.6 }}>
                    Structured lessons across all tracks. Progress is tracked per enrollment.
                  </Text>
                </div>

                {lessonsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12, color: L.textSec }}>
                    <RefreshCw size={20} className="animate-spin" />
                    <Text variant="body">Loading lessons...</Text>
                  </div>
                ) : lessons.length === 0 ? (
                  <GlassSurfaceBase style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 36px' }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 16,
                      background: `${L.accent}14`,
                      border: `1px solid ${L.accent}28`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 20px',
                    }}>
                      <School size={28} color={L.accent} />
                    </div>
                    <Text variant="researchHeading" as="h3" style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', margin: '0 0 10px', color: L.textPrimary }}>
                      No Lessons Published
                    </Text>
                    <Text variant="body" style={{ fontSize: 13, color: L.textSec, margin: '0 0 20px', lineHeight: 1.65 }}>
                      The lesson catalog is empty. Generate a lesson from any course to get started.
                    </Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
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
                          style={{
                            padding: '8px 14px',
                            background: `${getTierColor(course.tier)}12`,
                            border: `1px solid ${getTierColor(course.tier)}30`,
                            borderRadius: 8,
                            color: getTierColor(course.tier),
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: generatingLesson ? 'wait' : 'pointer',
                            opacity: generatingLesson ? 0.6 : 1,
                            transition: 'all .18s',
                          }}
                        >
                          {generatingLesson ? 'Generating...' : course.title}
                        </button>
                      ))}
                    </div>
                  </GlassSurfaceBase>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {Object.entries(lessonsByCourse).map(([courseId, courseLessons]) => {
                      const course = courses.find(c => c.id === courseId);
                      const tierColor = course ? getTierColor(course.tier) : L.accent;
                      return (
                        <div key={courseId}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${tierColor}14`, border: `1px solid ${tierColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {course ? React.createElement(getTierIcon(course.tier), { size: 15, color: tierColor }) : <School size={15} color={tierColor} />}
                            </div>
                            <div>
                              <Text variant="subheading" style={{ fontSize: 15, fontWeight: 800, color: L.textPrimary }}>{course?.title ?? courseLessons[0]?.courseTitle ?? 'Unknown Course'}</Text>
                            </div>
                            <div style={{ flex: 1, height: 1, background: `linear-gradient(to right,${tierColor}20,transparent)` }}/>
                            <Text variant="label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: L.textTer }}>{courseLessons.length} lessons</Text>
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
              <div style={{ maxWidth: 520 }}>
                <div style={{ marginBottom: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 16, height: 1, background: L.textSec, opacity: .4 }}/>
                    <Text variant="label" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: L.textSec }}>Configuration</Text>
                  </div>
                  <Text variant="researchHeading" as="h2" style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', margin: 0, letterSpacing: '-.025em', color: L.textPrimary, lineHeight: 1 }}>Settings</Text>
                </div>

                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Text variant="label" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: L.accent }}>Canvas LMS</Text>
                    <div style={{ flex: 1, height: 1, background: L.border }}/>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <Text variant="label" as="label" style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: L.textSec, marginBottom: 8 }}>API Token</Text>
                      <input type="password" value={canvasToken}
                        onChange={e => saveConfig({ canvasToken: e.target.value })}
                        placeholder="Paste your Canvas API token here"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, color: '#f0f0f0', fontSize: 14, outline: 'none', transition: 'border-color .18s', boxSizing: 'border-box' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,.4)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; }}
                      />
                      <Text variant="caption" style={{ fontSize: 11, color: L.textTer, marginTop: 6, lineHeight: 1.55, display: 'block' }}>Canvas → Account → Settings → Approved Integrations → New Access Token</Text>
                    </div>
                    <div>
                      <Text variant="label" as="label" style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: L.textSec, marginBottom: 8 }}>Domain</Text>
                      <input type="text" value={canvasDomain}
                        onChange={e => saveConfig({ canvasDomain: e.target.value })}
                        placeholder="https://canvas.instructure.com"
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, color: '#f0f0f0', fontSize: 14, outline: 'none', transition: 'border-color .18s', boxSizing: 'border-box' }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,.4)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; }}
                      />
                    </div>
                  </div>
                </div>

                <GlassSurfaceThin style={{ padding: '18px 20px', background: L.accentDim, border: `1px solid ${L.accentBorder}`, borderRadius: 13 }}>
                  <Text variant="label" style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: L.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Eye size={12}/> Getting Your Canvas Token
                  </Text>
                  <ol style={{ margin: 0, paddingLeft: 18, color: L.textSec, fontSize: 12, lineHeight: 2 }}>
                    <li>Log in to Canvas</li>
                    <li>Go to Account → Settings</li>
                    <li>Scroll to Approved Integrations</li>
                    <li>Click <em>New Access Token</em> and copy the generated value</li>
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

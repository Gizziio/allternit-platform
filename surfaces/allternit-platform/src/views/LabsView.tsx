/**
 * A://Labs View - Learning Portal
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
} from 'lucide-react';
import { useNav } from '@/nav/useNav';
import { CertificationsPanel } from './CertificationsPanel';
import { AgentElementsWorkspace } from './chat/AgentElementsWorkspace';
import { ResearchTab } from './research/ResearchTab';
import { DiscoveryFeed } from './discovery/DiscoveryFeed';
import { notebookApi } from './research/hooks/useNotebookApi';

import type { ModeSessionMessage } from '@/lib/agents/mode-session-store';

type Tab = 'discovery' | 'research' | 'tracks' | 'certifications' | 'agent-elements' | 'settings';

const LABS_STORAGE_KEY = 'allternit-labs-config';

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

const ALABS_COURSES: ALABSCourse[] = [
  {
    id: '14593493',
    code: 'ALABS-CORE-COPILOT',
    title: 'Build AI-Assisted Software with Copilot & Cursor',
    description: 'Learn to use GitHub Copilot and Cursor as infrastructure layers for code generation, refactoring, and MCP tool building.',
    tier: 'CORE',
    canvasUrl: 'https://canvas.instructure.com/courses/14593493',
    modules: 7,
    capstone: 'Build a TypeScript MCP Server with Cursor',
    coverImage: '/images/alabs-covers/ALABS-CORE-COPILOT.png',
  },
  {
    id: '14593495',
    code: 'ALABS-CORE-PROMPTS',
    title: 'Prompt Engineering & Systematic LLM Reasoning',
    description: 'Master prompt engineering from first principles: systematic prompting, Python API patterns, and red-teaming.',
    tier: 'CORE',
    canvasUrl: 'https://canvas.instructure.com/courses/14593495',
    modules: 7,
    capstone: 'Design a 3-Prompt Suite + Red-Team Report',
    coverImage: '/images/alabs-covers/ALABS-CORE-PROMPTS.png',
  },
  {
    id: '14593499',
    code: 'ALABS-OPS-N8N',
    title: 'Orchestrate Agents & Automations with n8n',
    description: 'Build production business workflows with n8n: architecture, patterns, OpenAI agent nodes, and self-hosted scaling.',
    tier: 'OPS',
    canvasUrl: 'https://canvas.instructure.com/courses/14593499',
    modules: 8,
    capstone: 'Build a Self-Hosted n8n MCP Workflow',
    coverImage: '/images/alabs-covers/ALABS-OPS-N8N.png',
  },
  {
    id: '14593501',
    code: 'ALABS-OPS-VISION',
    title: 'Computer Vision for Agent Systems',
    description: 'Connect OpenCV and vision models to agent systems. Feature detection, object tracking, and screen-state analysis.',
    tier: 'OPS',
    canvasUrl: 'https://canvas.instructure.com/courses/14593501',
    modules: 6,
    capstone: 'Build a Screen-State Analyzer for LLM Agents',
    coverImage: '/images/alabs-covers/ALABS-OPS-VISION.png',
  },
  {
    id: '14593503',
    code: 'ALABS-OPS-RAG',
    title: 'Local RAG & Document Intelligence',
    description: 'Build privacy-preserving RAG pipelines with local LLMs, semantic search, and offline document Q&A agents.',
    tier: 'OPS',
    canvasUrl: 'https://canvas.instructure.com/courses/14593503',
    modules: 7,
    capstone: 'Offline Document-QA Agent',
    coverImage: '/images/alabs-covers/ALABS-OPS-RAG.png',
  },
  {
    id: '14593505',
    code: 'ALABS-AGENTS-ML',
    title: 'ML Models as Agent Tools',
    description: 'When to use ML vs. LLMs vs. rules. Wrap scikit-learn models as MCP tools and integrate them into agent workflows.',
    tier: 'AGENTS',
    canvasUrl: 'https://canvas.instructure.com/courses/14593505',
    modules: 6,
    capstone: 'Wrap a Scikit-Learn Model as an MCP Tool',
    coverImage: '/images/alabs-covers/ALABS-AGENTS-ML.png',
  },
  {
    id: '14593507',
    code: 'ALABS-AGENTS-AGENTS',
    title: 'Multi-Agent Systems & Orchestration',
    description: 'Design collaborative agent swarms: tool-using agents, code-generation agents, and multi-agent orchestration patterns.',
    tier: 'AGENTS',
    canvasUrl: 'https://canvas.instructure.com/courses/14593507',
    modules: 7,
    capstone: 'Design a 3-Agent Collaborative Blog-Writing System',
    coverImage: '/images/alabs-covers/ALABS-AGENTS-AGENTS.png',
  },
  {
    id: '14612851',
    code: 'ALABS-ADV-PLUGINSDK',
    title: 'Build Plugins for Allternit',
    description: 'Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, publishing, and production integration.',
    tier: 'ADV',
    canvasUrl: 'https://canvas.instructure.com/courses/14612851',
    modules: 4,
    capstone: 'Build a Cross-Platform Plugin with PluginHost',
    coverImage: '/images/alabs-covers/ALABS-ADV-PLUGINSDK.png',
    demosUrl: '/demos/ALABS-ADV-PLUGINSDK-module1.html',
  },
  {
    id: '14612861',
    code: 'ALABS-ADV-WORKFLOW',
    title: 'The Allternit Workflow Engine',
    description: 'Visual DAG orchestration, scheduler, execution model, and production workflow integration.',
    tier: 'ADV',
    canvasUrl: 'https://canvas.instructure.com/courses/14612861',
    modules: 3,
    capstone: 'Build a Custom Workflow Node',
    coverImage: '/images/alabs-covers/ALABS-ADV-WORKFLOW.png',
    demosUrl: '/demos/ALABS-ADV-WORKFLOW-module1.html',
  },
  {
    id: '14612869',
    code: 'ALABS-ADV-ADAPTERS',
    title: 'Provider Adapters & Unified APIs',
    description: 'Abstraction layers, rate limiting, resilience patterns, failover, and production API integration.',
    tier: 'ADV',
    canvasUrl: 'https://canvas.instructure.com/courses/14612869',
    modules: 3,
    capstone: 'Build a Provider Adapter for a New API',
    coverImage: '/images/alabs-covers/ALABS-ADV-ADAPTERS.png',
    demosUrl: '/demos/ALABS-ADV-ADAPTERS-module1.html',
  },
];

const AGENT_ELEMENTS_PREVIEW_MESSAGES: ModeSessionMessage[] = [
  {
    id: 'ae-user-1',
    role: 'user',
    content: 'A://ultrathink audit the chat UI and propose the smallest safe integration plan.',
    timestamp: '2026-04-24T12:00:00.000Z',
  },
  {
    id: 'ae-assistant-1',
    role: 'assistant',
    content: 'I mapped the integration into composer controls, transcript renderers, and a non-primary preview surface.',
    thinking: 'Preserve the existing shell. Swap only the subcomponents that fit the current interaction model.',
    timestamp: '2026-04-24T12:00:02.000Z',
    metadata: {
      agentElementsParts: [
        {
          type: 'tool-PlanWrite',
          toolCallId: 'plan-preview-1',
          input: {
            steps: [
              { step: 'Keep ChatView composition intact', status: 'completed' },
              { step: 'Embed inline composer bars', status: 'completed' },
              { step: 'Route transcript tools to imported renderers', status: 'completed' },
            ],
          },
          output: {
            steps: [
              { step: 'Keep ChatView composition intact', status: 'completed' },
              { step: 'Embed inline composer bars', status: 'completed' },
              { step: 'Route transcript tools to imported renderers', status: 'completed' },
            ],
          },
          state: 'output-available',
        },
        {
          type: 'tool-Agent',
          toolCallId: 'subagent-preview-1',
          input: { description: 'Verify the imported tool renderers against nested tool output' },
          output: { totalDurationMs: 4200 },
          state: 'output-available',
        },
      ],
    },
  },
  {
    id: 'ae-assistant-2',
    role: 'assistant',
    content: 'The preview also exercises user messages, suggestions, the imported input stack, send button, loaders, and inline error rendering.',
    timestamp: '2026-04-24T12:00:04.000Z',
    metadata: {
      isError: true,
    },
  },
];

// ─── Design tokens ───────────────────────────────────────────────────────────
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

const LABS_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,900&family=Syne:wght@400;500;600;700;800&display=swap');

  .labs-root { scrollbar-width: thin; scrollbar-color: rgba(167,139,250,.18) transparent; }
  .labs-root::before {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:9999;
    opacity:.032;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)'/%3E%3C/svg%3E");
    background-size:256px;
  }
  .labs-root::-webkit-scrollbar { width:5px; }
  .labs-root::-webkit-scrollbar-thumb { background:rgba(167,139,250,.18); border-radius:99px; }
  .labs-root::-webkit-scrollbar-track { background:transparent; }

  .labs-serif  { font-family:'Fraunces',Georgia,'Times New Roman',serif !important; }
  .labs-display{ font-family:'Syne',system-ui,sans-serif !important; }

  @keyframes labs-reveal { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  .labs-reveal { opacity:0; }
  .labs-reveal.is-visible { animation:labs-reveal .68s cubic-bezier(.16,1,.3,1) forwards; }

  @keyframes labs-slide-in { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  @keyframes labs-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .labs-spin { animation:labs-spin 1s linear infinite; }

  .labs-card-hover { transition:all .22s cubic-bezier(.4,0,.2,1); }
  .labs-card-hover:hover { transform:translateY(-4px); box-shadow:0 16px 48px rgba(0,0,0,.5); }
  .labs-img-zoom img { transition:transform .4s cubic-bezier(.4,0,.2,1); }
  .labs-img-zoom:hover img { transform:scale(1.04); }

  .labs-tab-btn {
    padding:12px 18px; background:transparent; border:none;
    border-bottom:2px solid transparent; cursor:pointer;
    font-size:13px; display:flex; align-items:center; gap:6px;
    transition:all .18s; margin-bottom:-1px; white-space:nowrap;
  }
  .labs-tab-btn.active { border-bottom-color:#a78bfa; color:#f0f0f0; font-weight:600; }
  .labs-tab-btn:not(.active) { color:#484848; font-weight:400; }
  .labs-tab-btn:not(.active):hover { color:#888; }

  .labs-input {
    width:100%; padding:10px 14px;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.08);
    border-radius:10px; color:#f0f0f0; font-size:14px;
    outline:none; transition:border-color .18s; box-sizing:border-box;
  }
  .labs-input:focus { border-color:rgba(167,139,250,.4); }
  .labs-input::placeholder { color:#3a3a3a; }
`;

function useLabsReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('labs-reveal');
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); }
    }, { threshold: 0.07 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

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

// ─── CourseCard ──────────────────────────────────────────────────────────────
interface CourseCardProps {
  course: ALABSCourse;
  tierColor: string;
  canvasToken: string;
  onOpenNotebook: () => void;
  onSyncCanvas: () => void;
}

function CourseCard({ course, tierColor, canvasToken, onOpenNotebook, onSyncCanvas }: CourseCardProps) {
  const ref = useLabsReveal<HTMLDivElement>();
  const TierIcon = getTierIcon(course.tier);

  return (
    <div ref={ref} className="labs-card-hover" style={{
      background: L.bgCard,
      border: `1px solid ${L.border}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Cover image */}
      <div className="labs-img-zoom" style={{ position: 'relative', height: 160, flexShrink: 0, overflow: 'hidden' }}>
        <img
          src={course.coverImage}
          alt={course.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 40%, rgba(14,14,14,.92) 100%)` }} />
        {/* Tier badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px',
          background: `${tierColor}22`,
          border: `1px solid ${tierColor}44`,
          borderRadius: 99, backdropFilter: 'blur(8px)',
        }}>
          <TierIcon size={11} color={tierColor} />
          <span className="labs-display" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: tierColor }}>{course.tier}</span>
        </div>
        {/* Module count */}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <span className="labs-display" style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.06em' }}>{course.modules} modules</span>
        </div>
        {/* Course code bottom-left */}
        <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
          <span className="labs-display" style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: `${tierColor}bb` }}>{course.code}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Title */}
        <h3 className="labs-serif" style={{
          fontSize: 17, fontWeight: 900, fontStyle: 'italic',
          margin: '0 0 10px', color: L.textPrimary,
          letterSpacing: '-.02em', lineHeight: 1.25,
        }}>{course.title}</h3>

        {/* Description */}
        <p style={{
          fontSize: 12.5, color: L.textSec, margin: '0 0 16px',
          lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>{course.description}</p>

        {/* Capstone box */}
        <div style={{
          padding: '10px 14px', marginBottom: 18,
          background: `${tierColor}0a`, border: `1px solid ${tierColor}20`,
          borderRadius: 10,
        }}>
          <div className="labs-display" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: tierColor, marginBottom: 5 }}>Capstone</div>
          <div style={{ fontSize: 12, color: L.textPrimary, lineHeight: 1.4 }}>{course.capstone}</div>
        </div>

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
    </div>
  );
}

export function LabsView() {
  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('https://canvas.instructure.com');
  const [notification, setNotification] = useState<string | null>(null);

  // Load Canvas config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LABS_STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setCanvasToken(config.canvasToken || '');
        setCanvasDomain(config.canvasDomain || 'https://canvas.instructure.com');
      } catch {
        // ignore malformed config
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
      // Check if backend is available
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
      // Check for existing course notebook
      const existing = localStorage.getItem(`course-notebook-${course.id}`);
      let notebookId: string;

      if (existing) {
        notebookId = existing;
        // Verify it still exists
        const notebooks = await notebookApi.listNotebooks();
        const found = notebooks.find(n => n.id === notebookId);
        if (!found) {
          localStorage.removeItem(`course-notebook-${course.id}`);
          notebookId = await createCourseNotebook(course);
        }
      } else {
        notebookId = await createCourseNotebook(course);
      }

      // Switch to research tab with this notebook
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

    // Add course metadata as a source
    await notebookApi.addSource(notebookId, {
      type: 'text',
      title: `${course.code} — Course Overview`,
      content: `Course: ${course.title}\nCode: ${course.code}\nTier: ${course.tier}\nModules: ${course.modules}\nCapstone: ${course.capstone}\nDescription: ${course.description}\nCanvas URL: ${course.canvasUrl}`,
      status: 'extracted',
    });

    // Sync Canvas content via backend if token is available
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
    { id: 'research'       as Tab, icon: FlaskConical,  label: 'Research' },
    { id: 'tracks'         as Tab, icon: GraduationCap, label: 'A://Labs Tracks' },
    { id: 'certifications' as Tab, icon: Award,         label: 'Certifications' },
    { id: 'agent-elements' as Tab, icon: Rocket,        label: 'Agent Elements' },
    { id: 'settings'       as Tab, icon: Settings,      label: 'Settings' },
  ];

  return (
    <div className="labs-root" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: L.bg,
      color: L.textPrimary,
      position: 'relative',
    }}>
      <style>{LABS_CSS}</style>

      {/* Notification Toast */}
      {notification && (
        <div style={{ position:'fixed', top:20, right:20, background:'#0d1f17', border:'1px solid rgba(52,211,153,.25)', borderRadius:12, padding:'12px 20px', zIndex:190, animation:'labs-slide-in .3s ease-out', boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <CheckCircle size={16} color="#34d399" />
            <span style={{ fontSize:13, color:'var(--ui-text-primary)' }}>{notification}</span>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background:L.bgCard, borderBottom:`1px solid ${L.border}`, flexShrink:0, position:'relative', overflow:'hidden' }}>
        {/* Ambient orbs */}
        <div style={{ position:'absolute', top:-80, right:80, width:320, height:320, background:'radial-gradient(circle,rgba(167,139,250,.08),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, left:60, width:200, height:200, background:'radial-gradient(circle,rgba(245,158,11,.05),transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }}/>

        {/* Title row */}
        <div style={{ padding:'28px 36px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', position:'relative' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
              <div style={{ width:20, height:1, background:L.accent, opacity:.5 }}/>
              <span className="labs-display" style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:L.accent }}>Learning Portal</span>
            </div>
            <h1 className="labs-serif" style={{ fontSize:46, fontWeight:900, fontStyle:'italic', margin:'0 0 6px', letterSpacing:'-.03em', lineHeight:1, color:L.textPrimary }}>
              A://Labs
            </h1>
            <p className="labs-display" style={{ fontSize:12.5, color:L.textSec, margin:0, letterSpacing:'.01em' }}>
              10 live courses · 65 modules · open-source demos
            </p>
          </div>

          {/* Stats + CTAs */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:16, paddingTop:4 }}>
            <div style={{ display:'flex', gap:28 }}>
              {[
                { val:'65', label:'Modules',     color:L.gold },
                { val:'10', label:'Live Courses', color:'var(--status-success)' },
                { val:'51', label:'Assignments',  color:L.accent },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center' }}>
                  <div className="labs-serif" style={{ fontSize:28, fontWeight:900, fontStyle:'italic', color:s.color, lineHeight:1 }}>{s.val}</div>
                  <div className="labs-display" style={{ fontSize:9, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:L.textTer, marginTop:3 }}>{s.label}</div>
                </div>
              ))}
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

        {/* Tab bar — minimal underline strip */}
        <div style={{ display:'flex', overflowX:'auto', borderTop:`1px solid ${L.border}`, paddingLeft:36, paddingRight:36, scrollbarWidth:'none' }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`labs-tab-btn labs-display${activeTab===tab.id?' active':''}`}
            >
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'32px 36px' }}>

        {/* ── Discovery ── */}
        {activeTab === 'discovery' && <DiscoveryFeed />}

        {/* ── Research ── */}
        {activeTab === 'research' && (
          <div style={{ height:'calc(100vh - 260px)', minHeight:500 }}><ResearchTab /></div>
        )}

        {/* ── Tracks ── */}
        {activeTab === 'tracks' && (
          <div>
            {(['CORE','OPS','AGENTS','ADV'] as const).map(tier => {
              const TierIcon = getTierIcon(tier);
              const tierColor = getTierColor(tier);
              const tierCourses = ALABS_COURSES.filter(c => c.tier === tier);
              return (
                <div key={tier} style={{ marginBottom:52 }}>
                  {/* Tier section header */}
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${tierColor}14`, border:`1px solid ${tierColor}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <TierIcon size={18} color={tierColor} />
                    </div>
                    <div>
                      <span className="labs-serif" style={{ fontSize:22, fontWeight:900, fontStyle:'italic', color:L.textPrimary, letterSpacing:'-.02em' }}>Tier {tier}</span>
                    </div>
                    <div style={{ flex:1, height:1, background:`linear-gradient(to right,${tierColor}25,transparent)` }}/>
                    <span className="labs-display" style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:L.textTer }}>{tierCourses.length} courses</span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
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
          </div>
        )}

        {/* ── Certifications ── */}
        {activeTab === 'certifications' && <CertificationsPanel />}

        {/* ── Agent Elements ── */}
        {activeTab === 'agent-elements' && (
          <div style={{ minHeight:'70vh' }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:16, height:1, background:'#ec4899', opacity:.5 }}/>
                <span className="labs-display" style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:'#ec4899' }}>Internal Preview</span>
              </div>
              <h2 className="labs-serif" style={{ fontSize:30, fontWeight:900, fontStyle:'italic', margin:'0 0 6px', letterSpacing:'-.025em', color:L.textPrimary, lineHeight:1 }}>Agent Elements</h2>
              <p className="labs-display" style={{ fontSize:12, color:L.textSec, margin:0, letterSpacing:'.01em', lineHeight:1.6 }}>
                Composition-root preview — agent-chat, message-list, input-bar, model &amp; mode selectors.
              </p>
            </div>
            <div style={{ height:'calc(100vh - 340px)', minHeight:580, borderRadius:16, overflow:'hidden', border:`1px solid ${L.border}`, boxShadow:'0 24px 64px rgba(0,0,0,.4)' }}>
              <AgentElementsWorkspace messages={AGENT_ELEMENTS_PREVIEW_MESSAGES} isLoading={false} onSend={async()=>{}} onStop={()=>{}}/>
            </div>
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth:520 }}>
            <div style={{ marginBottom:36 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ width:16, height:1, background:L.textSec, opacity:.4 }}/>
                <span className="labs-display" style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:L.textSec }}>Configuration</span>
              </div>
              <h2 className="labs-serif" style={{ fontSize:30, fontWeight:900, fontStyle:'italic', margin:0, letterSpacing:'-.025em', color:L.textPrimary, lineHeight:1 }}>Settings</h2>
            </div>

            <div style={{ marginBottom:32 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                <span className="labs-display" style={{ fontSize:10, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:L.accent }}>Canvas LMS</span>
                <div style={{ flex:1, height:1, background:L.border }}/>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
                <div>
                  <label className="labs-display" style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:L.textSec, marginBottom:8 }}>API Token</label>
                  <input type="password" value={canvasToken}
                    onChange={e => saveConfig({ canvasToken: e.target.value })}
                    placeholder="Paste your Canvas API token here"
                    className="labs-input"
                  />
                  <p style={{ fontSize:11, color:L.textTer, marginTop:6, lineHeight:1.55 }}>Canvas → Account → Settings → Approved Integrations → New Access Token</p>
                </div>
                <div>
                  <label className="labs-display" style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:L.textSec, marginBottom:8 }}>Domain</label>
                  <input type="text" value={canvasDomain}
                    onChange={e => saveConfig({ canvasDomain: e.target.value })}
                    placeholder="https://canvas.instructure.com"
                    className="labs-input"
                  />
                </div>
              </div>
            </div>

            <div style={{ padding:'18px 20px', background:L.accentDim, border:`1px solid ${L.accentBorder}`, borderRadius:13 }}>
              <p className="labs-display" style={{ margin:'0 0 12px', fontWeight:700, fontSize:11, letterSpacing:'.08em', textTransform:'uppercase', color:L.accent, display:'flex', alignItems:'center', gap:6 }}>
                <Eye size={12}/> Getting Your Canvas Token
              </p>
              <ol style={{ margin:0, paddingLeft:18, color:L.textSec, fontSize:12, lineHeight:2 }}>
                <li>Log in to Canvas</li>
                <li>Go to Account → Settings</li>
                <li>Scroll to Approved Integrations</li>
                <li>Click <em>New Access Token</em> and copy the generated value</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LabsView;

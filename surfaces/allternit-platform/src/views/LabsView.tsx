/**
 * A://Labs View - Learning Portal
 *
 * UI component for browsing live A://Labs Canvas tracks,
 * downloading Udemy source courses, and managing course content.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  Download, 
  FolderOpen, 
  Settings, 
  Search, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  HardDrive,
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

// Types
interface UdemyCourse {
  id: number;
  title: string;
  headline: string;
  image_240x135: string;
  url: string;
  published_title: string;
  num_lectures?: number;
}

interface LocalCourse {
  id: number;
  title: string;
  downloadDate: string;
  status: 'downloading' | 'completed' | 'failed' | 'partial';
  totalFiles: number;
  totalSize: number;
  path: string;
}

interface DownloadProgress {
  courseId: number;
  fileName: string;
  downloaded: number;
  total: number;
  speed: number;
}

type Tab = 'discovery' | 'research' | 'tracks' | 'browse' | 'downloads' | 'certifications' | 'agent-elements' | 'settings';

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

function getTierColor(tier: string) {
  switch (tier) {
    case 'CORE': return '#3b82f6';
    case 'OPS': return '#8b5cf6';
    case 'AGENTS': return '#ec4899';
    case 'ADV': return '#f59e0b';
    default: return '#6b7280';
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

export function LabsView() {
  const { dispatch } = useNav();
  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [courses, setCourses] = useState<UdemyCourse[]>([]);
  const [localCourses, setLocalCourses] = useState<LocalCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [subDomain, setSubDomain] = useState('www');
  const [downloadPath, setDownloadPath] = useState('~/Downloads/UdemyCourses');
  const [canvasToken, setCanvasToken] = useState('');
  const [canvasDomain, setCanvasDomain] = useState('https://canvas.instructure.com');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LABS_STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setAccessToken(config.accessToken || '');
        setSubDomain(config.subDomain || 'www');
        setDownloadPath(config.downloadPath || '~/Downloads/UdemyCourses');
        setCanvasToken(config.canvasToken || '');
        setCanvasDomain(config.canvasDomain || 'https://canvas.instructure.com');
      } catch (e) {
        console.error('Failed to load labs config:', e);
      }
    }
  }, []);

  // Listen for Discovery → Research navigation
  useEffect(() => {
    const handler = (e: CustomEvent<{ notebookId?: string }>) => {
      setActiveTab('research');
      // Notebook ID can be passed to ResearchTab via a store or query param
      if (e.detail?.notebookId) {
        window.dispatchEvent(new CustomEvent('allternit:research-open-notebook', {
          detail: { notebookId: e.detail.notebookId }
        }));
      }
    };
    window.addEventListener('allternit:open-research-notebook' as any, handler);
    return () => window.removeEventListener('allternit:open-research-notebook' as any, handler);
  }, []);

  // Save config to localStorage
  const saveConfig = useCallback((config: { accessToken?: string; subDomain?: string; downloadPath?: string; canvasToken?: string; canvasDomain?: string }) => {
    const current = JSON.parse(localStorage.getItem(LABS_STORAGE_KEY) || '{}');
    const updated = { ...current, ...config };
    localStorage.setItem(LABS_STORAGE_KEY, JSON.stringify(updated));
    
    if (config.accessToken !== undefined) setAccessToken(config.accessToken);
    if (config.subDomain !== undefined) setSubDomain(config.subDomain);
    if (config.downloadPath !== undefined) setDownloadPath(config.downloadPath);
    if (config.canvasToken !== undefined) setCanvasToken(config.canvasToken);
    if (config.canvasDomain !== undefined) setCanvasDomain(config.canvasDomain);
  }, []);

  // Show notification
  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Fetch courses from Udemy via backend
  const fetchCourses = useCallback(async () => {
    if (!accessToken) {
      setError('Please enter your Udemy access token in Settings');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/udemy/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          subDomain,
          page: 1,
          pageSize: 50,
          search: searchQuery || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      setCourses(data.results || []);
      showNotification(`Loaded ${data.results?.length || 0} enrolled courses`);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  }, [accessToken, subDomain, searchQuery, showNotification]);

  // Download a course (simulation - in production, calls backend service)
  const downloadCourse = useCallback(async (course: UdemyCourse) => {
    if (downloading) {
      showNotification('A download is already in progress');
      return;
    }

    setDownloading(course.id);
    setProgress({
      courseId: course.id,
      fileName: 'Initializing...',
      downloaded: 0,
      total: 0,
      speed: 0,
    });
    setError(null);

    try {
      // NOTE: This is a placeholder. In production, call the actual downloader API
      // For now, we simulate the download flow
      showNotification(`Download started: ${course.title}`);
      
      // Simulate progress (remove in production)
      let pct = 0;
      const interval = setInterval(() => {
        pct += 10;
        if (pct >= 100) {
          clearInterval(interval);
          setDownloading(null);
          setProgress(null);
          
          // Add to local courses
          const newLocal: LocalCourse = {
            id: course.id,
            title: course.title,
            downloadDate: new Date().toISOString(),
            status: 'completed',
            totalFiles: 0,
            totalSize: 0,
            path: `${downloadPath}/${course.id}-${course.title.replace(/[^a-zA-Z0-9]/g, '-')}`,
          };
          setLocalCourses(prev => [...prev, newLocal]);
          showNotification(`Download complete: ${course.title}`);
        } else {
          setProgress({
            courseId: course.id,
            fileName: `Downloading lecture ${Math.floor(pct / 10)}...`,
            downloaded: pct,
            total: 100,
            speed: 0,
          });
        }
      }, 500);

    } catch (err: any) {
      setError(err.message || 'Download failed');
      setDownloading(null);
      setProgress(null);
    }
  }, [downloading, downloadPath, showNotification]);

  // Delete local course
  const deleteCourse = useCallback(async (courseId: number, title: string) => {
    if (!confirm(`Delete "${title}" from local storage?`)) return;
    
    setLocalCourses(prev => prev.filter(c => c.id !== courseId));
    showNotification(`Deleted: ${title}`);
  }, [showNotification]);

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

  // Format file size
  const formatSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  };

  // Format date
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary, #0a0a0a)',
      color: 'var(--text-primary, #e5e5e5)',
    }}>
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'var(--success-bg, #065f46)',
          border: '1px solid var(--success-border, #059669)',
          borderRadius: 8,
          padding: '12px 20px',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={18} color="#34d399" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid var(--border-subtle, #27272a)',
        background: 'var(--bg-secondary, #111113)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <GraduationCap size={32} color="#a78bfa" />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              A://Labs
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)', margin: 0 }}>
              Learning Portal & Course Manager
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <a
              href="https://allternit.com/demos"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                border: 'none',
                borderRadius: 8,
                color: '#0a0a0a',
                fontWeight: 600,
                fontSize: 14,
                textDecoration: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Play size={18} />
              Open-Source Demos
            </a>
            <button
              onClick={() => dispatch({ type: 'OPEN_VIEW', viewType: 'catalog' })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Globe size={18} />
              Browse Free Catalog
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { id: 'discovery' as Tab, icon: Compass, label: 'Discovery' },
            { id: 'research' as Tab, icon: FlaskConical, label: 'Research' },
            { id: 'tracks' as Tab, icon: GraduationCap, label: 'A://Labs Tracks' },
            { id: 'browse' as Tab, icon: BookOpen, label: 'Browse Udemy' },
            { id: 'downloads' as Tab, icon: Download, label: 'My Downloads' },
            { id: 'certifications' as Tab, icon: Award, label: 'Certifications' },
            { id: 'agent-elements' as Tab, icon: Rocket, label: 'Agent Elements' },
            { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: activeTab === tab.id 
                  ? 'var(--accent, #7c3aed)' 
                  : 'transparent',
                border: '1px solid var(--border-subtle, #27272a)',
                borderRadius: 6,
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary, #d4d4d8)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {/* Error Banner */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: 'var(--error-bg, #450a0a)',
            border: '1px solid var(--error-border, #b91c1c)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <AlertCircle size={18} color="#f87171" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Download Progress Bar */}
        {downloading && progress && (
          <div style={{
            marginBottom: 20,
            padding: 16,
            background: 'var(--bg-secondary, #111113)',
            border: '1px solid var(--border-subtle, #27272a)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                <Download size={16} style={{ display: 'inline', marginRight: 6 }} />
                Downloading...
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)' }}>
                {Math.round((progress.downloaded / progress.total) * 100)}%
              </span>
            </div>
            <div style={{
              height: 6,
              background: 'var(--bg-tertiary, #18181b)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(progress.downloaded / progress.total) * 100}%`,
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
              {progress.fileName}
            </div>
          </div>
        )}

        {/* Discovery Tab */}
        {activeTab === 'discovery' && (
          <DiscoveryFeed />
        )}

        {/* Tracks Tab */}
        {activeTab === 'tracks' && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 24,
            }}>
              <GraduationCap size={28} color="#a78bfa" />
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                  A://Labs Learning Tracks
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)', margin: '4px 0 0' }}>
                  10 live Canvas courses · 65 modules · 51 assignments · open-source demos
                </p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>65</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Modules</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>10</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Demos</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>0</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Audit Issues</div>
                </div>
              </div>
            </div>

            {(['CORE', 'OPS', 'AGENTS', 'ADV'] as const).map(tier => {
              const TierIcon = getTierIcon(tier);
              const tierCourses = ALABS_COURSES.filter(c => c.tier === tier);
              return (
                <div key={tier} style={{ marginBottom: 32 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 16,
                    padding: '10px 14px',
                    background: 'var(--bg-secondary, #111113)',
                    border: `1px solid ${getTierColor(tier)}33`,
                    borderRadius: 8,
                  }}>
                    <TierIcon size={20} color={getTierColor(tier)} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: getTierColor(tier) }}>
                      Tier {tier}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginLeft: 'auto' }}>
                      {tierCourses.length} courses
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 16,
                  }}>
                    {tierCourses.map(course => (
                      <div
                        key={course.code}
                        style={{
                          display: 'block',
                          background: 'var(--bg-secondary, #111113)',
                          border: '1px solid var(--border-subtle, #27272a)',
                          borderRadius: 10,
                          padding: 20,
                          color: 'var(--text-primary, #e5e5e5)',
                          transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = getTierColor(tier);
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = '';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-subtle, #27272a)';
                        }}
                      >
                        <a href={course.canvasUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                        >
                          <img
                            src={course.coverImage}
                            alt={course.title}
                            style={{
                              width: '100%',
                              height: 140,
                              objectFit: 'cover',
                              borderRadius: 6,
                              marginBottom: 12,
                              background: '#0b0b0c',
                            }}
                          />
                        </a>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 10,
                        }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: `${getTierColor(tier)}22`,
                            color: getTierColor(tier),
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}>
                            {course.code}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted, #a1a1aa)' }}>
                            {course.modules} modules
                          </span>
                        </div>

                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                          {course.title}
                        </h3>
                        <p style={{
                          fontSize: 13,
                          color: 'var(--text-secondary, #d4d4d8)',
                          margin: '0 0 14px',
                          lineHeight: 1.5,
                        }}>
                          {course.description}
                        </p>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontSize: 12,
                        }}>
                          <a
                            href={course.canvasUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted, #a1a1aa)', textDecoration: 'none' }}
                          >
                            <ExternalLink size={14} />
                            Open in Canvas
                          </a>
                          <button
                            onClick={() => openCourseNotebook(course)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'none',
                              border: 'none',
                              color: '#a78bfa',
                              cursor: 'pointer',
                              fontSize: 12,
                              padding: 0,
                            }}
                          >
                            <BookOpen size={14} />
                            Open Notebook
                          </button>
                          {canvasToken && course.canvasUrl && localStorage.getItem(`course-notebook-${course.id}`) && (
                            <button
                              onClick={() => syncCanvasForCourse(course)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: 'none',
                                border: 'none',
                                color: '#34d399',
                                cursor: 'pointer',
                                fontSize: 12,
                                padding: 0,
                              }}
                            >
                              <RefreshCw size={14} />
                              Sync Canvas
                            </button>
                          )}
                          {course.demosUrl && (
                            <a
                              href={course.demosUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                color: '#f59e0b',
                                textDecoration: 'none',
                              }}
                            >
                              <Play size={14} />
                              Try Demo
                            </a>
                          )}
                        </div>

                        <div style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: '1px solid var(--border-subtle, #27272a)',
                          fontSize: 12,
                          color: 'var(--text-muted, #a1a1aa)',
                        }}>
                          <strong style={{ color: 'var(--text-secondary, #d4d4d8)' }}>Capstone:</strong> {course.capstone}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {/* Search Bar */}
            <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search 
                  size={18} 
                  color="#a1a1aa" 
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} 
                />
                <input
                  type="text"
                  placeholder="Search your courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchCourses()}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                onClick={fetchCourses}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  background: 'var(--accent, #7c3aed)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Course Grid */}
            {courses.length === 0 && !loading ? (
              <div style={{
                textAlign: 'center',
                padding: 60,
                color: 'var(--text-muted, #a1a1aa)',
              }}>
                <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ fontSize: 16, marginBottom: 8 }}>
                  No courses loaded
                </p>
                <p style={{ fontSize: 13 }}>
                  Click "Refresh" to fetch your Udemy courses
                </p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 20,
              }}>
                {courses
                  .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(course => {
                    const isDownloaded = localCourses.some(lc => lc.id === course.id);
                    const isDownloading = downloading === course.id;

                    return (
                      <div
                        key={course.id}
                        style={{
                          background: 'var(--bg-secondary, #111113)',
                          border: '1px solid var(--border-subtle, #27272a)',
                          borderRadius: 10,
                          overflow: 'hidden',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.transform = '';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                        }}
                      >
                        {/* Course Image */}
                        <div style={{ position: 'relative' }}>
                          <img
                            src={course.image_240x135}
                            alt={course.title}
                            style={{ width: '100%', height: 135, objectFit: 'cover' }}
                          />
                          {isDownloaded && (
                            <div style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              background: '#059669',
                              borderRadius: 20,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}>
                              <CheckCircle size={12} />
                              Downloaded
                            </div>
                          )}
                        </div>

                        {/* Course Info */}
                        <div style={{ padding: 16 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                            {course.title}
                          </h3>
                          <p style={{ 
                            fontSize: 13, 
                            color: 'var(--text-muted, #a1a1aa)', 
                            margin: '0 0 12px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {course.headline}
                          </p>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => downloadCourse(course)}
                              disabled={isDownloading || isDownloaded}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                background: isDownloading 
                                  ? 'var(--text-muted, #a1a1aa)' 
                                  : isDownloaded 
                                    ? '#059669' 
                                    : 'var(--accent, #7c3aed)',
                                border: 'none',
                                borderRadius: 6,
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: isDownloading || isDownloaded ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isDownloading ? (
                                <>
                                  <RefreshCw size={14} className="animate-spin" />
                                  Downloading...
                                </>
                              ) : isDownloaded ? (
                                <>
                                  <CheckCircle size={14} />
                                  Downloaded
                                </>
                              ) : (
                                <>
                                  <Download size={14} />
                                  Download
                                </>
                              )}
                            </button>
                            <a
                              href={`https://${subDomain}.udemy.com${course.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: '1px solid var(--border-subtle, #27272a)',
                                borderRadius: 6,
                                color: 'var(--text-secondary, #d4d4d8)',
                                textDecoration: 'none',
                              }}
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Downloads Tab */}
        {/* Research Tab */}
        {activeTab === 'research' && (
          <div style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
            <ResearchTab />
          </div>
        )}

        {activeTab === 'downloads' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
              <FolderOpen size={20} style={{ display: 'inline', marginRight: 8 }} />
              My Downloaded Courses
            </h2>

            {localCourses.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 60,
                color: 'var(--text-muted, #a1a1aa)',
              }}>
                <HardDrive size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ fontSize: 16, marginBottom: 8 }}>No courses downloaded yet</p>
                <p style={{ fontSize: 13 }}>
                  Go to "Browse Courses" to download your courses
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {localCourses.map(course => (
                  <div
                    key={course.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: 16,
                      background: 'var(--bg-secondary, #111113)',
                      border: '1px solid var(--border-subtle, #27272a)',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>
                        {course.title}
                      </h3>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {formatDate(course.downloadDate)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <HardDrive size={12} />
                          {formatSize(course.totalSize)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {course.status === 'completed' ? (
                            <CheckCircle size={12} color="#34d399" />
                          ) : (
                            <AlertCircle size={12} color="#f87171" />
                          )}
                          {course.status}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => showNotification(`Opening: ${course.path}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 12px',
                          background: 'transparent',
                          border: '1px solid var(--border-subtle, #27272a)',
                          borderRadius: 6,
                          color: 'var(--text-secondary, #d4d4d8)',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <FolderOpen size={14} />
                        Open Folder
                      </button>
                      <button
                        onClick={() => deleteCourse(course.id, course.title)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: 8,
                          background: 'transparent',
                          border: '1px solid var(--error-border, #b91c1c)',
                          borderRadius: 6,
                          color: '#f87171',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Certifications Tab */}
        {activeTab === 'certifications' && (
          <CertificationsPanel />
        )}

        {activeTab === 'agent-elements' && (
          <div style={{ minHeight: '70vh' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                Agent Elements Preview
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted, #a1a1aa)', margin: '6px 0 0' }}>
                Internal preview for composition-root imports. This keeps `agent-chat`, `message-list`, `input-bar`, model and mode selectors reachable without replacing the main chat surface.
              </p>
            </div>
            <div
              style={{
                height: 'calc(100vh - 320px)',
                minHeight: 640,
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle, #27272a)',
              }}
            >
              <AgentElementsWorkspace
                messages={AGENT_ELEMENTS_PREVIEW_MESSAGES}
                isLoading={false}
                onSend={async () => {}}
                onStop={() => {}}
              />
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
              <Settings size={20} style={{ display: 'inline', marginRight: 8 }} />
              Settings
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Access Token */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Udemy Access Token
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => saveConfig({ accessToken: e.target.value })}
                  placeholder="Paste your Udemy access token here"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginTop: 6 }}>
                  Get your token from browser DevTools → Application → Cookies → access_token
                </p>
              </div>

              {/* Subdomain */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Udemy Subdomain
                </label>
                <input
                  type="text"
                  value={subDomain}
                  onChange={(e) => saveConfig({ subDomain: e.target.value })}
                  placeholder="www (or your business subdomain)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Download Path */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Download Directory
                </label>
                <input
                  type="text"
                  value={downloadPath}
                  onChange={(e) => saveConfig({ downloadPath: e.target.value })}
                  placeholder="~/Downloads/UdemyCourses"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Canvas Token */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Canvas API Token
                </label>
                <input
                  type="password"
                  value={canvasToken}
                  onChange={(e) => saveConfig({ canvasToken: e.target.value })}
                  placeholder="Paste your Canvas API token here"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', marginTop: 6 }}>
                  Get your token from Canvas → Account → Settings → Approved Integrations → New Access Token
                </p>
              </div>

              {/* Canvas Domain */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  Canvas Domain
                </label>
                <input
                  type="text"
                  value={canvasDomain}
                  onChange={(e) => saveConfig({ canvasDomain: e.target.value })}
                  placeholder="https://canvas.instructure.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary, #111113)',
                    border: '1px solid var(--border-subtle, #27272a)',
                    borderRadius: 6,
                    color: 'var(--text-primary, #e5e5e5)',
                    fontSize: 14,
                  }}
                />
              </div>

              {/* Info Card */}
              <div style={{
                padding: 16,
                background: 'var(--info-bg, #1e1b4b)',
                border: '1px solid var(--info-border, #4338ca)',
                borderRadius: 8,
                fontSize: 13,
              }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                  <Eye size={14} style={{ display: 'inline', marginRight: 6 }} />
                  Getting Your Access Token
                </p>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Log in to Udemy in your browser</li>
                  <li>Open DevTools (F12)</li>
                  <li>Go to Application/Storage tab</li>
                  <li>Find Cookies → udemy.com</li>
                  <li>Copy the <code>access_token</code> value</li>
                  <li>Paste it above</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default LabsView;

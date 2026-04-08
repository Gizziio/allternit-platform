/**
 * Agent Mode Registry
 * 
 * Central registry for all 10 core agent capability modes
 * Maps mode IDs to their implementations and metadata
 */

import type { AgentModeId } from '@/stores/agent-surface-mode.store';

export interface ModeCapability {
  id: AgentModeId;
  name: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  providers?: string[];
  deterministicOutput: string;
  implementationStatus: 'complete' | 'partial' | 'stub' | 'planned';
}

// 10 Core Agent Capability Modes
export const MODE_CAPABILITIES: Record<string, ModeCapability> = {
  research: {
    id: 'research',
    name: 'Research',
    description: 'Create research documents with citations',
    icon: 'FileText',
    color: '#3b82f6',
    features: [
      'web-search',
      'citation-generation',
      'source-verification',
      'document-synthesis',
      'fact-checking',
    ],
    providers: ['gpt-researcher', 'tavily', 'perplexity-api'],
    deterministicOutput: 'Research document with citations and executive summary',
    implementationStatus: 'partial',
  },
  data: {
    id: 'data',
    name: 'Data',
    description: 'Analyze data with spreadsheets & charts',
    icon: 'Table',
    color: '#10b981',
    features: [
      'csv-parser',
      'excel-parser',
      'chart-generator',
      'sql-query',
      'statistical-analysis',
    ],
    providers: ['perspective', 'recharts', 'papaparse'],
    deterministicOutput: 'Interactive data tables, charts, and insights',
    implementationStatus: 'partial',
  },
  slides: {
    id: 'slides',
    name: 'Slides',
    description: 'Create presentations with speaker notes',
    icon: 'MonitorPlay',
    color: '#f59e0b',
    features: [
      'auto-outline',
      'slide-renderer',
      'template-engine',
      'pptx-export',
      'pdf-export',
    ],
    providers: ['pptxgenjs', 'slidev', 'reveal.js'],
    deterministicOutput: 'Slide deck with presenter notes in PPTX/PDF/HTML',
    implementationStatus: 'partial',
  },
  code: {
    id: 'code',
    name: 'Code',
    description: 'Generate and run code with preview',
    icon: 'Code',
    color: '#8b5cf6',
    features: [
      'code-generation',
      'syntax-highlighting',
      'code-execution',
      'live-preview',
      'multi-file',
    ],
    providers: ['webcontainers', 'sandpack', 'monaco-editor'],
    deterministicOutput: 'Executable code with live preview',
    implementationStatus: 'complete',
  },
  assets: {
    id: 'assets',
    name: 'Assets',
    description: 'Browse and manage files',
    icon: 'FolderOpen',
    color: '#ec4899',
    features: [
      'file-browser',
      'file-upload',
      'file-preview',
      'file-search',
      'auto-tagging',
    ],
    deterministicOutput: 'Organized file structure with metadata',
    implementationStatus: 'partial',
  },
  agents: {
    id: 'agents',
    name: 'Agents',
    description: 'Multi-agent orchestration',
    icon: 'Cpu',
    color: '#ef4444',
    features: [
      'agent-coordinator',
      'task-decomposition',
      'parallel-execution',
      'result-synthesis',
      'swarm-mode',
    ],
    providers: ['langgraph', 'autogen', 'crewai'],
    deterministicOutput: 'Coordinated multi-agent workflow results',
    implementationStatus: 'partial',
  },
  flow: {
    id: 'flow',
    name: 'Flow',
    description: 'Build automation workflows',
    icon: 'Network',
    color: '#06b6d4',
    features: [
      'flow-designer',
      'trigger-system',
      'action-library',
      'flow-execution',
      'flow-monitoring',
    ],
    providers: ['n8n', 'flowise', 'trigger.dev'],
    deterministicOutput: 'Executable workflow definition with run history',
    implementationStatus: 'partial',
  },
  web: {
    id: 'web',
    name: 'Web',
    description: 'Browse web with screenshots',
    icon: 'Globe',
    color: '#6366f1',
    features: [
      'browser-automation',
      'screenshot-capture',
      'web-search',
      'content-extraction',
      'form-filling',
    ],
    providers: ['playwright', 'puppeteer', 'ui-tars'],
    deterministicOutput: 'Web page content with screenshots and extracted data',
    implementationStatus: 'complete',
  },
  image: {
    id: 'image',
    name: 'Image',
    description: 'Generate images from text prompts',
    icon: 'Image',
    color: '#a855f7',
    features: [
      'text-to-image',
      'image-variations',
      'image-editing',
      'image-upscaling',
      'gallery-view',
    ],
    providers: ['dalle3', 'stability', 'midjourney', 'invokeai'],
    deterministicOutput: 'Generated images with metadata and variations',
    implementationStatus: 'stub',
  },
  video: {
    id: 'video',
    name: 'Video',
    description: 'Generate videos from text or images',
    icon: 'Video',
    color: '#f43f5e',
    features: [
      'text-to-video',
      'image-to-video',
      'video-editing',
      'video-player',
      'export-formats',
    ],
    providers: ['minimax', 'runway', 'pika', 'stable-video'],
    deterministicOutput: 'Generated video files with playback',
    implementationStatus: 'stub',
  },
};

// Helper to get mode by ID
export function getModeCapability(id: AgentModeId): ModeCapability | undefined {
  return MODE_CAPABILITIES[id];
}

// Helper to get all modes as array
export function getAllModes(): ModeCapability[] {
  return Object.values(MODE_CAPABILITIES);
}

// Helper to get modes by implementation status
export function getModesByStatus(status: ModeCapability['implementationStatus']): ModeCapability[] {
  return Object.values(MODE_CAPABILITIES).filter(m => m.implementationStatus === status);
}

// Implementation roadmap
export const MODE_IMPLEMENTATION_ROADMAP = {
  phase1: ['image', 'video'], // New modes needing full implementation
  phase2: ['research', 'data', 'slides'], // Enhancement needed
  phase3: ['assets', 'agents', 'flow'], // Integration with open source tools
  complete: ['code', 'web'], // Already functional
};

// Export individual mode services
export * from './image-generation';
export * from './video-generation';

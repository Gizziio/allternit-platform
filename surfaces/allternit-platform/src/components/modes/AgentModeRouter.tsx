"use client";

import React from 'react';
import { useAgentSurfaceModeStore, type AgentModeId } from '@/stores/agent-surface-mode.store';
import { ImageModeView } from './ImageModeView';
import { VideoModeView } from './VideoModeView';
import {
  DeepResearchModeView,
  DataStudioModeView,
  PitchDeckModeView,
  FileVaultModeView,
  SwarmsModeView,
  AutoFlowModeView,
  SiteBuilderModeView,
} from './ModeViews';

interface AgentModeRouterProps {
  surface: 'chat' | 'cowork' | 'code' | 'browser';
}

/**
 * Agent Mode Router
 * 
 * Renders the appropriate mode view based on selected mode
 * Maps new descriptive names to their implementations
 */
export function AgentModeRouter({ surface }: AgentModeRouterProps) {
  const { selectedModeBySurface } = useAgentSurfaceModeStore();
  const currentMode = selectedModeBySurface[surface];

  // If no mode selected, show default or null
  if (!currentMode) {
    return null;
  }

  switch (currentMode) {
    // 1. Deep Research - Multi-source research with citations
    case 'research':
      return <DeepResearchModeView />;

    // 2. Data Studio - Data analysis with charts
    case 'data':
      return <DataStudioModeView />;

    // 3. Pitch Deck - Presentation generation
    case 'slides':
      return <PitchDeckModeView />;

    // 4. Code Forge - Code generation & execution
    case 'code':
      // Code mode is handled separately in Code surface
      return null;

    // 5. File Vault - Smart file management
    case 'assets':
      return <FileVaultModeView />;

    // 6. Swarms - Multi-agent orchestration
    case 'swarms':
      return <SwarmsModeView />;

    // 7. Auto Flow - Workflow automation
    case 'flow':
      return <AutoFlowModeView />;

    // 8. Site Builder - Website generation (NOT web browsing)
    case 'website':
      return <SiteBuilderModeView />;

    // 9. Pixel Studio - Image generation (FREE)
    case 'image':
      return <ImageModeView />;

    // 10. Video - Video generation
    case 'video':
      return <VideoModeView />;

    default:
      return <ModePlaceholder mode={currentMode} />;
  }
}

// ==========================================
// PLACEHOLDER COMPONENTS
// ==========================================

function DeepResearchModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">📚</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Research</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Multi-source research with automatic synthesis and citations.
        Leverages platform LLM + web search plugin.
      </p>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Implementation: Web search plugin integration
      </div>
    </div>
  );
}

function DataStudioModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">📊</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Data</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Upload CSV/Excel files and get automatic charts, insights, and SQL queries.
        Uses Excel Plugin + Chart generation.
      </p>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Implementation: Excel Plugin + Recharts
      </div>
    </div>
  );
}

function PitchDeckModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">🎯</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Slides</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Auto-generate presentations with speaker notes from any topic.
        Uses PPT Plugin + LLM content generation.
      </p>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Implementation: PPT Plugin + Templates
      </div>
    </div>
  );
}

function FileVaultModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-pink-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">📁</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Assets</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Smart file management with AI auto-tagging and semantic search.
        Uses Office Plugin + LLM content analysis.
      </p>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Implementation: Office Plugin + Search
      </div>
    </div>
  );
}

function SwarmsModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">🤖</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Swarms</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Coordinate multiple AI agents working in parallel on complex tasks.
        Uses LangGraph + Platform LLM Brain.
      </p>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Implementation: LangGraph orchestration
      </div>
    </div>
  );
}

function AutoFlowModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">⚡</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Flow</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Build automated workflows with visual builder.
        Uses Flowise/n8n integration.
      </p>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Implementation: Flowise visual builder
      </div>
    </div>
  );
}

function SiteBuilderModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">🌐</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Website</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Generate complete, deployable websites from text descriptions or clone existing sites.
        Uses Platform LLM + Extension DOM Capture + Sandpack preview.
      </p>
      <div className="space-y-2 text-xs text-white/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          From text description
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          From image mockup
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Clone existing site (Extension DOM)
        </div>
        <div className="flex items-center gap-2 mt-4">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          Priority implementation
        </div>
      </div>
    </div>
  );
}

function MotionLabModePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4">
        <span className="text-2xl">🎬</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">Video</h3>
      <p className="text-sm text-center max-w-md mb-4">
        Generate videos from text prompts or images.
      </p>
      <div className="p-4 bg-white/5 rounded-lg border border-white/10 max-w-md mb-4">
        <p className="text-xs text-white/40 mb-2">Video Generation Options:</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/60">MiniMax video-01</span>
            <span className="text-emerald-400">$0.43/video</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60">Local Stable Video</span>
            <span className="text-emerald-400">FREE (self-hosted)</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        Requires external provider (no free cloud option available)
      </div>
    </div>
  );
}

function ModePlaceholder({ mode }: { mode: AgentModeId }) {
  const modeNames: Record<string, string> = {
    research: 'Research',
    data: 'Data',
    slides: 'Slides',
    code: 'Code',
    assets: 'Assets',
    swarms: 'Swarms',
    flow: 'Flow',
    website: 'Website',
    image: 'Image',
    video: 'Video',
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-white/50">
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
        <span className="text-2xl">⚡</span>
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{modeNames[mode] || mode}</h3>
      <p className="text-sm text-center max-w-md">
        This mode is being implemented.
      </p>
    </div>
  );
}

export default AgentModeRouter;

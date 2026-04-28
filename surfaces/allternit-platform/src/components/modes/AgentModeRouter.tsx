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

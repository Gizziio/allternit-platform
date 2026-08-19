import React, { useState, useEffect } from 'react';

import { ChatComposer } from '../chat/ChatComposer';
import { useModelSelection } from '@/providers/model-selection-provider';
import { ModelPicker } from '@/components/model-picker';
import { useSurfaceAgentModeEnabled } from '@/lib/agents/surface-agent-context';
import { RecentSessionsStrip } from './RecentSessionsStrip';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import {
  LAUNCH_TOP_PADDING,
  LAUNCH_SECTION_GAP,
  LAUNCH_COMPOSER_WIDTH,
} from '../chat/main/launchScreenLayout';
import { LaunchHeader } from '../chat/main/LaunchHeader';
import {
  DEFAULT_LAUNCH_GREETING,
  getLaunchGreeting,
  peekLaunchGreeting,
} from '../chat/main/launchGreeting';

interface CoworkLaunchpadProps {
  onStartChat: (text: string) => void;
  onResumeThread: (id: string) => void;
}

export function CoworkLaunchpad({ onStartChat, onResumeThread }: CoworkLaunchpadProps) {
  const agentModeEnabled = useSurfaceAgentModeEnabled('cowork');
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();
  // Same session greeting as the Chat launch screen — must not re-roll on toggle.
  const [greeting, setGreeting] = useState(() => peekLaunchGreeting() ?? DEFAULT_LAUNCH_GREETING);

  useEffect(() => {
    let cancelled = false;
    getLaunchGreeting().then((g) => {
      if (!cancelled) setGreeting(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{
      padding: `${LAUNCH_TOP_PADDING} 40px 80px`,
      height: '100%',
      overflowY: 'auto',
      background: 'transparent',
      color: 'var(--ui-text-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      isolation: 'isolate',
    }}>
      <AgentModeBackdrop
        active={agentModeEnabled}
        surface="cowork"
        dataTestId="agent-mode-cowork-backdrop"
      />
      <div style={{ width: '100%', maxWidth: '720px', position: 'relative', zIndex: 1 }}>
        {/* Greeting header — identical to the Chat launch screen (shared
            component + session greeting) so toggling modes doesn't change it. */}
        <LaunchHeader greeting={greeting} logo="matrix" />

        {/* Primary Functional Composer — same column width as the Chat
            launch screen. The attached CoworkTopDeck inside ChatComposer
            occupies the band where Chat shows its quick-action pill row. */}
        <div style={{
          width: '100%',
          maxWidth: LAUNCH_COMPOSER_WIDTH,
          margin: `0 auto ${LAUNCH_SECTION_GAP}px`,
        }}>
          <ChatComposer 
            onSend={onStartChat}
            variant="large"
            placeholder="What should we coordinate, build, or review?"
            selectedModel={modelSelection?.modelId}
            selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
            onOpenModelPicker={startSelection}
            onSelectModel={selectModel}
            showTopActions={false}
            inputValue=""
            agentModeSurface="cowork"
          />
        </div>

        {/* Recent Sessions */}
        <RecentSessionsStrip onResume={onResumeThread} />

        <ModelPicker
          open={isSelecting}
          onOpenChange={(open) => { if (!open) cancelSelection(); }}
          onSelect={selectModel}
          onCancel={cancelSelection}
          trigger={<div style={{ display: 'none' }} />}
        />
      </div>

    </div>
  );
}

/**
 * GizziPresence Component - Production UX
 *
 * Architecture:
 * - PresenceTransition: Only for orb/avatar (transient embodiment)
 * - GizziPanel: Shell overlay layer (sibling, not inside transition)
 * - Pure consumer of ActivityCenter + VoiceService
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAvatarState } from '../../hooks/avatar/useAvatarState';
import { useSpeakingSignal } from '../../hooks/avatar/useSpeakingSignal';
import { useAudioEnergy } from '../../hooks/avatar/useAudioEnergy';
import { GizziDock } from './GizziDock';
import { GizziPanel } from './GizziPanel';
import { PresenceTransition } from './PresenceTransition';
import { GizziAvatarPlaceholder } from './GizziAvatarPlaceholder';
import { activityCenter } from '../../runtime/ActivityCenter';

type Mode = 'chat' | 'conductor' | 'cowork';

interface VoiceOrbProps {
  isListening: boolean;
  onToggleListening: () => void;
  transcript?: string;
  onTranscript?: (text: string) => void;
  onSpeak?: (text: string) => void;
  size?: number;
  simple?: boolean;
}

interface GizziPresenceProps {
  voiceOrbProps: VoiceOrbProps;
  VoiceOrbComponent: React.ComponentType<VoiceOrbProps>;
  dockSize?: number;
  bottomOffset?: string;
  rightOffset?: string;
}

function getStoredMode(): Mode {
  if (typeof window === 'undefined') return 'cowork';
  const saved = sessionStorage.getItem('gizzi-selected-mode');
  if (saved === 'chat' || saved === 'conductor' || saved === 'cowork') {
    return saved as Mode;
  }
  return 'cowork';
}

function handleAvatarClick(): void {
  const activity = activityCenter.getCurrentActivity();
  if (!activity?.navTarget) return;

  const { navTarget } = activity;
  if (!['tab', 'chatSession', 'brainSession'].includes(navTarget.kind)) return;

  const event = new CustomEvent('navigateToTarget', {
    detail: navTarget,
    bubbles: true,
  });
  window.dispatchEvent(event);
}

export const GizziPresence: React.FC<GizziPresenceProps> = ({
  voiceOrbProps,
  VoiceOrbComponent,
  dockSize = 56,
  bottomOffset = '24px',
  rightOffset = '24px',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMode, setExpandedMode] = useState<Mode>('cowork');
  const { isEnabled, status, renderMode, transitionPhase } = useAvatarState();
  const { isSpeaking } = useSpeakingSignal();
  const { energy } = useAudioEnergy();

  const handleExpand = useCallback((mode: Mode) => {
    setExpandedMode(mode);
    setIsExpanded(true);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    sessionStorage.removeItem('gizzi-selected-mode');
  }, []);

  // Clean up stored mode on unmount
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('gizzi-selected-mode');
    };
  }, []);

  // When disabled, show dock only (no avatar transitions)
  if (!isEnabled) {
    return (
      <>
        {/* Panel layer: Shell overlay */}
        {isExpanded && (
          <GizziPanel
            onClose={handleCollapse}
            initialMode={expandedMode}
          />
        )}

        <GizziDock
          VoiceOrbComponent={VoiceOrbComponent}
          voiceOrbProps={voiceOrbProps}
          onExpand={handleExpand}
          orbSize={dockSize}
          bottomOffset={bottomOffset}
          rightOffset={rightOffset}
        />
      </>
    );
  }

  // When enabled, show status-aware dock with transition support
  return (
    <>
      {/* Panel layer: Shell overlay */}
      {isExpanded && (
        <GizziPanel
          onClose={handleCollapse}
          initialMode={expandedMode}
        />
      )}

      {/* Presence layer: orb / avatar (transient embodiment only) */}
      <PresenceTransition
        renderMode={renderMode}
        transitionPhase={transitionPhase}
        orbElement={
          <GizziDock
            VoiceOrbComponent={VoiceOrbComponent}
            voiceOrbProps={voiceOrbProps}
            onExpand={handleExpand}
            orbSize={dockSize}
            bottomOffset={bottomOffset}
            rightOffset={rightOffset}
          />
        }
        avatarElement={
          <GizziAvatarPlaceholder
            status={status}
            speaking={isSpeaking}
            amplitude={energy}
            size={dockSize}
            onClick={handleAvatarClick}
          />
        }
        position="fixed"
        bottomOffset={bottomOffset}
        rightOffset={rightOffset}
      />
    </>
  );
};

interface GizziPresenceLiteProps {
  voiceOrbProps: VoiceOrbProps;
  VoiceOrbComponent: React.ComponentType<VoiceOrbProps>;
  dockSize?: number;
  className?: string;
}

export const GizziPresenceLite: React.FC<GizziPresenceLiteProps> = ({
  voiceOrbProps,
  VoiceOrbComponent,
  dockSize = 56,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMode, setExpandedMode] = useState<Mode>('cowork');
  const { isEnabled, status, renderMode, transitionPhase } = useAvatarState();
  const { isSpeaking } = useSpeakingSignal();
  const { energy } = useAudioEnergy();

  const handleExpand = useCallback((mode: Mode) => {
    setExpandedMode(mode);
    setIsExpanded(true);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    sessionStorage.removeItem('gizzi-selected-mode');
  }, []);

  useEffect(() => {
    return () => {
      sessionStorage.removeItem('gizzi-selected-mode');
    };
  }, []);

  if (!isEnabled) {
    return (
      <div className={className}>
        {isExpanded && (
          <GizziPanel
            onClose={handleCollapse}
            initialMode={expandedMode}
          />
        )}
        <GizziDock
          VoiceOrbComponent={VoiceOrbComponent}
          voiceOrbProps={voiceOrbProps}
          onExpand={handleExpand}
          orbSize={dockSize}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {isExpanded && (
        <GizziPanel
          onClose={handleCollapse}
          initialMode={expandedMode}
        />
      )}
      <PresenceTransition
        renderMode={renderMode}
        transitionPhase={transitionPhase}
        orbElement={
          <GizziDock
            VoiceOrbComponent={VoiceOrbComponent}
            voiceOrbProps={voiceOrbProps}
            onExpand={handleExpand}
            orbSize={dockSize}
          />
        }
        avatarElement={
          <GizziAvatarPlaceholder
            status={status}
            speaking={isSpeaking}
            amplitude={energy}
            size={dockSize}
            onClick={handleAvatarClick}
          />
        }
        position="relative"
      />
    </div>
  );
};

export default GizziPresence;

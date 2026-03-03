/**
 * Agent Message Avatar
 * 
 * Small avatar component for chat messages.
 * Shows emotion based on agent state (typing, processing, etc.)
 */

import React from 'react';
import { AgentAvatar } from './AgentAvatar';
import type { AvatarConfig, AvatarEmotion } from '../../lib/agents/character.types';

interface AgentMessageAvatarProps {
  avatarConfig?: AvatarConfig;
  size?: number;
  state?: 'idle' | 'typing' | 'processing' | 'complete' | 'error';
  className?: string;
}

const STATE_TO_EMOTION: Record<string, AvatarEmotion> = {
  idle: 'steady',
  typing: 'focused',
  processing: 'focused',
  complete: 'pleased',
  error: 'skeptical',
};

export const AgentMessageAvatar: React.FC<AgentMessageAvatarProps> = ({
  avatarConfig,
  size = 32,
  state = 'idle',
  className = '',
}) => {
  if (!avatarConfig) {
    return null;
  }

  const emotion = STATE_TO_EMOTION[state] || 'steady';
  const isAnimating = state === 'typing' || state === 'processing';

  return (
    <div
      className={`agent-message-avatar ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <AgentAvatar
        config={avatarConfig}
        size={size}
        emotion={emotion}
        isAnimating={isAnimating}
      />
    </div>
  );
};

AgentMessageAvatar.displayName = 'AgentMessageAvatar';

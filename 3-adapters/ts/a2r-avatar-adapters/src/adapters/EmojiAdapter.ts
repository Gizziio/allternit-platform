/**
 * Emoji Avatar Adapter
 * 
 * Simple emoji-based avatar renderer.
 */

import type { AvatarAdapter } from '../types';
import { Mood, AvatarSize, VisualState, getMoodEmoji } from '@a2r/visual-state/types';

/**
 * Create emoji avatar adapter
 */
export function createEmojiAdapter(config?: {
  moodEmojis?: Partial<Record<Mood, string>>;
}): AvatarAdapter {
  const moodEmojis: Record<Mood, string> = {
    [Mood.Idle]: '😶',
    [Mood.Focused]: '🤔',
    [Mood.Thinking]: '🤯',
    [Mood.Uncertain]: '😕',
    [Mood.Celebrating]: '🎉',
    [Mood.Warning]: '⚠️',
    [Mood.Error]: '❌',
    [Mood.Listening]: '👂',
    [Mood.Speaking]: '💬',
    [Mood.Sleeping]: '😴',
    [Mood.Confused]: '😵‍💫',
    ...config?.moodEmojis,
  };

  const sizeScale: Record<AvatarSize, number> = {
    xs: 0.6,
    sm: 0.8,
    md: 1.0,
    lg: 1.5,
    xl: 2.0,
  };

  return {
    name: 'emoji',
    displayName: 'Emoji Avatar',
    description: 'Simple emoji-based avatars',
    
    render: (state: VisualState, size: AvatarSize) => {
      const emoji = moodEmojis[state.mood] || '🤖';
      const scale = sizeScale[size];
      const fontSize = 24 * scale * (0.8 + state.intensity / 50);
      
      const opacity = 0.5 + (state.confidence * 0.5);
      const filter = state.reliability < 0.5 ? 'grayscale(50%)' : 'none';
      
      return (
        React.createElement('span', {
          style: {
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            opacity,
            filter,
            transition: 'all 0.3s ease',
            display: 'inline-block',
          },
        }, emoji)
      );
    },
    
    supportedMoods: Object.values(Mood),
    supportsIntensity: true,
    supportsConfidence: true,
    supportsReliability: true,
  };
}

// React import for type safety
import React from 'react';

/**
 * Default emoji adapter instance
 */
export const emojiAdapter = createEmojiAdapter();

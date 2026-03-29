/**
 * Mode Selector Component
 * 
 * Allows users to switch between surfaces (Chat, Cowork, Code, Browser).
 * Following Claude Desktop pattern: separate UI per mode.
 */

import React from 'react';
import { useAgentModeStore, AgentModeSurface } from '@/stores/agent-surface-mode.store';

// ============================================================================
// Types
// ============================================================================

interface ModeConfig {
  id: AgentModeSurface;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: '💬',
    description: 'Quick conversations and Q&A',
    color: 'bg-blue-500',
  },
  {
    id: 'cowork',
    label: 'Cowork',
    icon: '🤖',
    description: 'Agentic workflows and planning',
    color: 'bg-amber-500',
  },
  {
    id: 'code',
    label: 'Code',
    icon: '💻',
    description: 'Code development with CLI sync',
    color: 'bg-emerald-500',
  },
  {
    id: 'browser',
    label: 'Browser',
    icon: '🌐',
    description: 'Browser automation',
    color: 'bg-teal-500',
  },
];

// ============================================================================
// Component
// ============================================================================

export function ModeSelector() {
  const currentMode = useAgentSurfaceModeStore((state) => state.currentSurface);
  const setMode = useAgentSurfaceModeStore((state) => state.setCurrentSurface);
  
  return (
    <div className="mode-selector">
      <div className="mode-selector-header">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Mode
        </h3>
      </div>
      
      <div className="mode-selector-buttons">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setMode(mode.id)}
            className={`
              mode-button
              ${currentMode === mode.id ? 'active' : ''}
              ${currentMode === mode.id ? mode.color : 'bg-gray-100'}
            `}
            title={mode.description}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-label">{mode.label}</span>
            {currentMode === mode.id && (
              <span className="mode-indicator" />
            )}
          </button>
        ))}
      </div>
      
      <div className="mode-description">
        <p className="text-xs text-gray-500">
          {MODES.find((m) => m.id === currentMode)?.description}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Styles (CSS Module or Tailwind)
// ============================================================================

/*
.mode-selector {
  @apply p-3 border-b border-gray-200;
}

.mode-selector-header {
  @apply mb-2;
}

.mode-selector-buttons {
  @apply grid grid-cols-2 gap-2;
}

.mode-button {
  @apply flex flex-col items-center justify-center p-3 rounded-lg
         transition-all duration-200 ease-in-out
         hover:opacity-90 hover:scale-105
         focus:outline-none focus:ring-2 focus:ring-offset-2;
}

.mode-button.active {
  @apply text-white shadow-md;
}

.mode-button:not(.active) {
  @apply text-gray-700 hover:bg-gray-200;
}

.mode-icon {
  @apply text-xl mb-1;
}

.mode-label {
  @apply text-xs font-medium;
}

.mode-indicator {
  @apply absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-pulse;
}

.mode-description {
  @apply mt-2 text-center;
}
*/

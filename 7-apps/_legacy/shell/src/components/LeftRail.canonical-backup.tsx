import * as React from 'react';

export type ViewMode = 'canvas' | 'marketplace' | 'chats';

interface LeftRailProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSpawnGenerator?: () => void;
  activeCapsuleId?: string | null;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  refineOpen: boolean;
  onToggleRefine: () => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
}

export const LeftRail: React.FC<LeftRailProps> = ({
  viewMode,
  onViewModeChange,
  onSpawnGenerator,
  activeCapsuleId,
  inspectorOpen,
  onToggleInspector,
  consoleOpen,
  onToggleConsole,
}) => {
  return (
    <div className="left-rail">
      {/* ... */}
      <div className="rail-main">
        {/* Workspace - Main canvas view */}
        <button
          className={`rail-item ${viewMode === 'canvas' ? 'active' : ''}`}
          onClick={() => onViewModeChange('canvas')}
          title="Workspace"
          type="button"
        >
          <span className="rail-icon">🖥️</span>
        </button>

        {/* Chats */}
        <button
          className={`rail-item ${viewMode === 'chats' ? 'active' : ''}`}
          onClick={() => onViewModeChange('chats')}
          title="Chats"
          type="button"
        >
          <span className="rail-icon">💬</span>
        </button>

        {/* Image Generator - Launches ComfyUI Capsule */}
        <button
          className={`rail-item ${activeCapsuleId === 'singleton-comfyui-gen' ? 'active' : ''}`}
          onClick={() => {
            onSpawnGenerator?.();
            onViewModeChange('canvas');
          }}
          title="Image Studio"
          type="button"
        >
          <span className="rail-icon">🎨</span>
        </button>

        {/* Marketplace */}
        <button
          className={`rail-item ${viewMode === 'marketplace' ? 'active' : ''}`}
          onClick={() => onViewModeChange('marketplace')}
          title="Marketplace"
          type="button"
        >
          <span className="rail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </span>
        </button>

        {/* Console / Terminal - Opens bottom drawer */}
        <button
          className={`rail-item ${consoleOpen ? 'active' : ''}`}
          onClick={onToggleConsole}
          title="Console"
          type="button"
        >
          <span className="rail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </span>
        </button>
      </div>

      {/* Bottom Section */}
      <div className="rail-bottom">
        {/* History */}
        <button
          className="rail-item"
          onClick={() => {
            // TODO: Open history modal/view
            console.log('History clicked');
          }}
          title="History"
          type="button"
        >
          <span className="rail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
        </button>

        {/* Settings */}
        <button
          className="rail-item"
          onClick={() => {
            // TODO: Open settings modal
            console.log('Settings clicked');
          }}
          title="Settings"
          type="button"
        >
          <span className="rail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
        </button>

        {/* Profile */}
        <button
          className="rail-item"
          onClick={() => {
            // TODO: Open profile modal
            console.log('Profile clicked');
          }}
          title="Profile"
          type="button"
        >
          <span className="rail-avatar-icon">E</span>
        </button>
      </div>
    </div>
  );
};

import * as React from 'react';

export type ViewMode = 'canvas' | 'studio' | 'registry' | 'marketplace' | 'chats' | 'openwork';

interface LeftRailProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSpawnGenerator?: () => void;
  onSpawnBrowser?: () => void;
  activeCapsuleId?: string | null;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  refineOpen: boolean;
  onToggleRefine: () => void;
  consoleOpen: boolean;
  onToggleConsole: () => void;
  brainManagerOpen: boolean;
  onToggleBrainManager: () => void;
  memoryManagerOpen: boolean;
  onToggleMemoryManager: () => void;
}

export const LeftRail: React.FC<LeftRailProps> = ({
  viewMode,
  onViewModeChange,
  onSpawnGenerator,
  onSpawnBrowser,
  activeCapsuleId,
  inspectorOpen,
  onToggleInspector,
  consoleOpen,
  onToggleConsole,
  brainManagerOpen,
  onToggleBrainManager,
  memoryManagerOpen,
  onToggleMemoryManager,
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

        {/* Studio - Capability authoring */}
        <button
          className={`rail-item ${viewMode === 'studio' ? 'active' : ''}`}
          onClick={() => onViewModeChange('studio')}
          title="Studio"
          type="button"
        >
          <span className="rail-icon">🛠️</span>
        </button>

        {/* Registry - Authoritative catalog */}
        <button
          className={`rail-item ${viewMode === 'registry' ? 'active' : ''}`}
          onClick={() => onViewModeChange('registry')}
          title="Registry"
          type="button"
        >
          <span className="rail-icon">📚</span>
        </button>

        {/* Browser */}
        <button
          className={`rail-item ${activeCapsuleId === 'singleton-browser' ? 'active' : ''}`}
          onClick={() => {
            onSpawnBrowser?.();
            onViewModeChange('canvas');
          }}
          title="Browser"
          type="button"
        >
          <span className="rail-icon">🌐</span>
        </button>

        {/* OpenWork */}
        <button
          className={`rail-item ${viewMode === 'openwork' ? 'active' : ''}`}
          onClick={() => onViewModeChange('openwork')}
          title="Ops Center"
          type="button"
        >
          <span className="rail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5v10l-10 5z" />
              <path d="M12 22V11.5a5.5 5.5 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.25" />
              <polyline points="15 3 21 3 21 9" />
            </svg>
          </span>
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

        {/* Neural Runtime / Brain Manager */}
        <button
          className={`rail-item ${brainManagerOpen ? 'active' : ''}`}
          onClick={onToggleBrainManager}
          title="Neural Runtimes"
          type="button"
        >
          <span className="rail-icon">🧠</span>
        </button>

        {/* Memory Manager */}
        <button
          className={`rail-item ${memoryManagerOpen ? 'active' : ''}`}
          onClick={onToggleMemoryManager}
          title="Memory Manager"
          type="button"
        >
          <span className="rail-icon">💾</span>
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

/**
 * Workspace Browser Component
 * 
 * Main container for the workspace UI. Shows the 5-layer system
 * with navigation between different views.
 */

import { useState, useEffect } from 'react';
import { useWorkspace } from '../../agent-workspace/wasm-wrapper';
import { BrainView } from './BrainView';
import { MemoryEditor } from './MemoryEditor';
import { PolicyDashboard } from './PolicyDashboard';
import { SkillManager } from './SkillManager';
import { IdentityEditor } from './IdentityEditor';
import { WorkspaceMetadata, WorkspaceLayers } from './types';

interface WorkspaceBrowserProps {
  path: string;
  serverUrl?: string; // HTTP backend URL (e.g., "http://localhost:8080")
}

type ViewTab = 'brain' | 'memory' | 'policy' | 'skills' | 'identity';

export function WorkspaceBrowser({ path, serverUrl }: WorkspaceBrowserProps) {
  const { api, loading, error } = useWorkspace(path);
  const [activeTab, setActiveTab] = useState<ViewTab>('brain');
  const [metadata, setMetadata] = useState<WorkspaceMetadata | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error'>('connecting');

  useEffect(() => {
    if (api && !loading) {
      // Check if we're using HTTP backend (full functionality)
      // or WASM backend (limited functionality)
      const isHttpBackend = !!serverUrl;
      setConnectionStatus(isHttpBackend ? 'connected' : 'connected');
      
      // Load metadata
      api.workspace.getMetadata().then(setMetadata).catch(console.error);
    }
  }, [api, loading, serverUrl]);

  if (loading) {
    return (
      <div className="workspace-browser workspace-browser--loading">
        <div className="workspace-browser__spinner">
          <div className="spinner" />
          <p>Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace-browser workspace-browser--error">
        <div className="workspace-browser__error">
          <h2>Failed to load workspace</h2>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!api) {
    return (
      <div className="workspace-browser workspace-browser--error">
        <p>Workspace API not available</p>
      </div>
    );
  }

  return (
    <div className="workspace-browser">
      {/* Header */}
      <header className="workspace-browser__header">
        <div className="workspace-browser__title">
          <h1>{metadata?.agent_name || 'Agent Workspace'}</h1>
          <span className="workspace-browser__version">
            v{metadata?.workspace_version || '0.1.0'}
          </span>
        </div>
        
        <div className="workspace-browser__status">
          <ConnectionStatus status={connectionStatus} serverUrl={serverUrl} />
          <WorkspaceLayersIndicator layers={metadata?.layers} />
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="workspace-browser__tabs">
        <TabButton 
          active={activeTab === 'brain'} 
          onClick={() => setActiveTab('brain')}
          icon="🧠"
          label="Brain"
          description="Task graph & planning"
        />
        <TabButton 
          active={activeTab === 'memory'} 
          onClick={() => setActiveTab('memory')}
          icon="📝"
          label="Memory"
          description="Session logs & lessons"
        />
        <TabButton 
          active={activeTab === 'policy'} 
          onClick={() => setActiveTab('policy')}
          icon="🛡️"
          label="Policy"
          description="Safety rules & permissions"
        />
        <TabButton 
          active={activeTab === 'skills'} 
          onClick={() => setActiveTab('skills')}
          icon="🛠️"
          label="Skills"
          description="Tools & capabilities"
        />
        <TabButton 
          active={activeTab === 'identity'} 
          onClick={() => setActiveTab('identity')}
          icon="👤"
          label="Identity"
          description="Persona & configuration"
        />
      </nav>

      {/* Main Content */}
      <main className="workspace-browser__content">
        {activeTab === 'brain' && <BrainView api={api} />}
        {activeTab === 'memory' && <MemoryEditor api={api} />}
        {activeTab === 'policy' && <PolicyDashboard api={api} />}
        {activeTab === 'skills' && <SkillManager api={api} />}
        {activeTab === 'identity' && <IdentityEditor api={api} path={path} />}
      </main>
    </div>
  );
}

// Sub-components

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  description 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: string; 
  label: string;
  description: string;
}) {
  return (
    <button
      className={`workspace-browser__tab ${active ? 'workspace-browser__tab--active' : ''}`}
      onClick={onClick}
    >
      <span className="workspace-browser__tab-icon">{icon}</span>
      <span className="workspace-browser__tab-label">{label}</span>
      <span className="workspace-browser__tab-description">{description}</span>
    </button>
  );
}

function ConnectionStatus({ 
  status, 
  serverUrl 
}: { 
  status: 'connected' | 'connecting' | 'error';
  serverUrl?: string;
}) {
  const statusConfig = {
    connected: { color: '#10b981', text: 'Connected', icon: '✓' },
    connecting: { color: '#f59e0b', text: 'Connecting...', icon: '⟳' },
    error: { color: '#ef4444', text: 'Error', icon: '✕' },
  };

  const config = statusConfig[status];

  return (
    <div className="connection-status" title={serverUrl || 'WASM Backend'}>
      <span 
        className="connection-status__indicator" 
        style={{ backgroundColor: config.color }}
      >
        {config.icon}
      </span>
      <span className="connection-status__text">{config.text}</span>
      {serverUrl && (
        <span className="connection-status__url">({serverUrl})</span>
      )}
    </div>
  );
}

function WorkspaceLayersIndicator({ 
  layers 
}: { 
  layers?: WorkspaceLayers;
}) {
  if (!layers) return null;

  const layerStatus = [
    { name: 'Cognitive', active: layers.cognitive, icon: '🧠' },
    { name: 'Identity', active: layers.identity, icon: '👤' },
    { name: 'Governance', active: layers.governance, icon: '📜' },
    { name: 'Skills', active: layers.skills, icon: '🛠️' },
    { name: 'Business', active: layers.business, icon: '💼' },
  ];

  return (
    <div className="workspace-layers">
      {layerStatus.map(layer => (
        <span 
          key={layer.name}
          className={`workspace-layers__item ${layer.active ? 'workspace-layers__item--active' : ''}`}
          title={layer.name}
        >
          {layer.icon}
        </span>
      ))}
    </div>
  );
}

// CSS styles (to be used with CSS modules or styled-components)
export const workspaceBrowserStyles = `
.workspace-browser {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f0f0f;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.workspace-browser__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #2a2a2a;
  background: #1a1a1a;
}

.workspace-browser__title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.workspace-browser__title h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.workspace-browser__version {
  font-size: 0.75rem;
  color: #888;
  background: #2a2a2a;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.workspace-browser__status {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.workspace-browser__tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #1a1a1a;
  border-bottom: 1px solid #2a2a2a;
  overflow-x: auto;
}

.workspace-browser__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.25rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 80px;
}

.workspace-browser__tab:hover {
  background: #2a2a2a;
  color: #e0e0e0;
}

.workspace-browser__tab--active {
  background: #2a2a2a;
  border-color: #3b82f6;
  color: #e0e0e0;
}

.workspace-browser__tab-icon {
  font-size: 1.5rem;
}

.workspace-browser__tab-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.workspace-browser__tab-description {
  font-size: 0.7rem;
  color: #666;
}

.workspace-browser__content {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

.workspace-browser--loading,
.workspace-browser--error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.workspace-browser__spinner,
.workspace-browser__error {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2a2a2a;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.connection-status__indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6px;
  color: white;
}

.connection-status__url {
  color: #666;
  font-size: 0.75rem;
}

.workspace-layers {
  display: flex;
  gap: 0.5rem;
}

.workspace-layers__item {
  opacity: 0.3;
  font-size: 1rem;
  transition: opacity 0.2s;
}

.workspace-layers__item--active {
  opacity: 1;
}
`;

/**
 * Thin Client App Component - A2R Style
 * 
 * Header ALWAYS visible with settings, clear, close buttons
 * Input bar positioned close to bottom (4px padding)
 * Expands to show chat history
 * 
 * Features:
 * - Theme persistence (light/dark/system)
 * - Connection status with backend health check
 * - Settings persistence via zustand
 * - Backend unavailable state with retry
 */

import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { ChatContainer } from './ChatContainer';
import InputArea from './InputArea';
import { StatusBar } from './StatusBar';
import { BackendStatus } from './BackendStatus';
import { useConnection } from '../hooks/useConnection';
import { useChat } from '../hooks/useChat';
import { useSettingsStore, applyTheme, listenToSystemTheme } from '../stores/settingsStore';
import { useModelStore } from '../stores/modelStore';

export const ThinClientApp: React.FC = () => {
  const { status, backend, isUnavailable, isConnected } = useConnection();
  const { messages, isStreaming, sendMessage, clearChat } = useChat();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings store for theme and preferences
  const { theme, preferredBackend, setPreferredBackend } = useSettingsStore();
  
  // Model store for model selection
  const { selectedModel, fetchModels } = useModelStore();
  
  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
    
    // Listen for system theme changes if using system theme
    if (theme === 'system') {
      return listenToSystemTheme(() => applyTheme('system'));
    }
  }, [theme]);
  
  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);
  
  // Sync backend preference with connection
  useEffect(() => {
    if (backend !== preferredBackend && isConnected) {
      // Backend switched, update preference
      setPreferredBackend(backend);
    }
  }, [backend, preferredBackend, isConnected, setPreferredBackend]);
  
  // Compact when no messages (shows welcome + input)
  // Expanded when has messages (shows chat history)
  const isCompact = messages.length === 0;
  
  // Show backend unavailable overlay when disconnected
  const showUnavailable = isUnavailable && messages.length === 0;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to hide window
      if (e.key === 'Escape') {
        window.thinClient.hideWindow();
      }
      
      // Cmd/Ctrl+K to focus input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector('[data-input="true"]') as HTMLElement;
        input?.focus();
      }
      
      // Cmd/Ctrl+, to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSendMessage = (message: string) => {
    if (isConnected) {
      sendMessage(message);
    }
  };

  return (
    <div className={`thin-client-app ${isCompact ? 'compact' : 'expanded'} ${showUnavailable ? 'unavailable' : ''}`}>
      {/* Header ALWAYS visible */}
      <Header 
        backend={backend}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onClearChat={clearChat}
        isConnected={isConnected}
      />
      
      {/* Main content area */}
      <div className="content-area">
        {showUnavailable ? (
          /* Backend unavailable state */
          <BackendStatus compact={false} />
        ) : (
          <>
            {/* Chat container - only when expanded */}
            {!isCompact && (
              <ChatContainer 
                messages={messages}
                isStreaming={isStreaming}
              />
            )}
            
            {/* Welcome screen when compact and connected */}
            {isCompact && isConnected && (
              <WelcomeScreen selectedModel={selectedModel} />
            )}
            
            {/* Connection warning */}
            {!isConnected && !isUnavailable && (
              <ConnectionWarning status={status} />
            )}
          </>
        )}
      </div>
      
      {/* Input area at bottom with minimal padding */}
      <div className="input-wrapper">
        <InputArea 
          onSend={handleSendMessage}
          isStreaming={isStreaming}
          disabled={!isConnected}
          isCompact={isCompact}
        />
      </div>
      
      {/* Status bar - shows connection status */}
      <div className="status-bar-wrapper">
        <BackendStatus compact={true} />
      </div>

      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <style>{`
        .thin-client-app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          background: var(--color-bg-primary);
          border-radius: var(--radius-xl);
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        /* Content area takes remaining space */
        .content-area {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        
        /* Input wrapper - close to bottom */
        .input-wrapper {
          padding: 8px 12px 4px;
          width: 100%;
          display: flex;
          justify-content: center;
          flex-shrink: 0;
        }
        
        /* Status bar wrapper */
        .status-bar-wrapper {
          padding: 4px 12px 8px;
          display: flex;
          justify-content: center;
          flex-shrink: 0;
        }
        
        /* Compact mode adjustments */
        .thin-client-app.compact .content-area {
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

// Welcome screen shown in compact mode
const WelcomeScreen: React.FC<{ selectedModel: any }> = ({ selectedModel }) => {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <h2 className="welcome-title">How can Gizzi help you?</h2>
      <p className="welcome-subtitle">
        {selectedModel ? `Using ${selectedModel.name}` : 'Select a model to start chatting'}
      </p>
      
      <style>{`
        .welcome-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          gap: 8px;
          animation: fadeIn 0.3s ease;
        }
        
        .welcome-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(212, 149, 106, 0.2), rgba(212, 149, 106, 0.05));
          color: var(--color-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        
        .welcome-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-primary);
          margin: 0;
        }
        
        .welcome-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// Connection warning when connecting/disconnected
const ConnectionWarning: React.FC<{ status: string }> = ({ status }) => {
  const messages: Record<string, { icon: string; text: string }> = {
    connecting: { icon: '⏳', text: 'Connecting to Gizzi...' },
    disconnected: { icon: '🔌', text: 'Disconnected from server' },
    error: { icon: '⚠️', text: 'Connection error' },
  };
  
  const { icon, text } = messages[status] || messages.disconnected;
  
  return (
    <div className="connection-warning">
      <span className="warning-icon">{icon}</span>
      <span className="warning-text">{text}</span>
      
      <style>{`
        .connection-warning {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          color: var(--color-text-secondary);
          font-size: 13px;
        }
        
        .warning-icon {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};

// Enhanced settings modal with all preferences
const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const settings = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    // Apply all settings
    settings.setTheme(localSettings.theme);
    settings.setPreferredBackend(localSettings.preferredBackend);
    settings.setShowTimestamps(localSettings.showTimestamps);
    settings.setShowMetadata(localSettings.showMetadata);
    settings.setFontSize(localSettings.fontSize);
    settings.setAgentModeEnabled(localSettings.agentModeEnabled);
    settings.setComputerUseEnabled(localSettings.computerUseEnabled);
    
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          {/* Appearance */}
          <div className="settings-section">
            <h3>Appearance</h3>
            
            <div className="setting-row">
              <label>Theme</label>
              <select 
                value={localSettings.theme}
                onChange={e => setLocalSettings({ ...localSettings, theme: e.target.value as any })}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            
            <div className="setting-row">
              <label>Font Size</label>
              <select 
                value={localSettings.fontSize}
                onChange={e => setLocalSettings({ ...localSettings, fontSize: e.target.value as any })}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            
            <div className="setting-row checkbox">
              <label>Show Timestamps</label>
              <input 
                type="checkbox"
                checked={localSettings.showTimestamps}
                onChange={e => setLocalSettings({ ...localSettings, showTimestamps: e.target.checked })}
              />
            </div>
            
            <div className="setting-row checkbox">
              <label>Show Metadata</label>
              <input 
                type="checkbox"
                checked={localSettings.showMetadata}
                onChange={e => setLocalSettings({ ...localSettings, showMetadata: e.target.checked })}
              />
            </div>
          </div>
          
          {/* Connection */}
          <div className="settings-section">
            <h3>Connection</h3>
            
            <div className="setting-row">
              <label>Preferred Backend</label>
              <select 
                value={localSettings.preferredBackend}
                onChange={e => setLocalSettings({ ...localSettings, preferredBackend: e.target.value as any })}
              >
                <option value="desktop">Local Desktop</option>
                <option value="cloud">Cloud (a2r.io)</option>
              </select>
            </div>
          </div>
          
          {/* Features */}
          <div className="settings-section">
            <h3>Features</h3>
            
            <div className="setting-row checkbox">
              <label>
                Agent Mode
                <span className="setting-hint">Enable autonomous agent capabilities</span>
              </label>
              <input 
                type="checkbox"
                checked={localSettings.agentModeEnabled}
                onChange={e => setLocalSettings({ ...localSettings, agentModeEnabled: e.target.checked })}
              />
            </div>
            
            <div className="setting-row checkbox">
              <label>
                Computer Use
                <span className="setting-hint">Allow browser/desktop automation</span>
              </label>
              <input 
                type="checkbox"
                checked={localSettings.computerUseEnabled}
                onChange={e => setLocalSettings({ ...localSettings, computerUseEnabled: e.target.checked })}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
          padding: 16px;
        }
        
        .modal {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 420px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-window);
          animation: slideUp 0.25s ease;
        }
        
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--color-border);
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .close-btn {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        
        .close-btn:hover {
          background: var(--color-bg-hover);
          color: var(--color-text-primary);
        }
        
        .settings-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        
        .settings-section {
          margin-bottom: 24px;
        }
        
        .settings-section:last-child {
          margin-bottom: 0;
        }
        
        .settings-section h3 {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
        }
        
        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--color-border-light);
        }
        
        .setting-row:last-child {
          border-bottom: none;
        }
        
        .setting-row.checkbox {
          align-items: flex-start;
        }
        
        .setting-row label {
          font-size: 13px;
          color: var(--color-text-primary);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .setting-hint {
          font-size: 11px;
          color: var(--color-text-tertiary);
          font-weight: normal;
        }
        
        .setting-row select,
        .setting-row input[type="text"],
        .setting-row input[type="number"] {
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          font-size: 13px;
          min-width: 140px;
        }
        
        .setting-row input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: var(--color-accent);
          cursor: pointer;
        }
        
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid var(--color-border);
        }
        
        .modal-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: var(--radius-md);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .btn-secondary {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
        
        .btn-secondary:hover {
          background: var(--color-bg-tertiary);
        }
        
        .btn-primary {
          background: var(--color-accent);
          color: white;
        }
        
        .btn-primary:hover {
          background: var(--color-accent-hover);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/**
 * VM Manager Panel
 * 
 * React component for managing A2R VMs in the desktop app.
 * Provides UI for starting/stopping VMs, viewing status, and executing commands.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useVM } from '../../hooks/useVM';
import { VMStatus } from './VMStatus';
import { VMControls } from './VMControls';
import { VMCommandExecutor } from './VMCommandExecutor';
import { VMSetupWizard } from './VMSetupWizard';
import './VMManagerPanel.css';

export interface VMManagerPanelProps {
  className?: string;
}

export const VMManagerPanel: React.FC<VMManagerPanelProps> = ({ className }) => {
  const {
    status,
    isRunning,
    isStarting,
    isStopping,
    error,
    startVM,
    stopVM,
    restartVM,
    executeCommand,
    checkImages,
    downloadImages,
    imagesExist,
    isCheckingImages,
  } = useVM();

  const [showSetup, setShowSetup] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'commands' | 'logs'>('status');

  // Check images on mount
  useEffect(() => {
    checkImages();
  }, [checkImages]);

  // Show setup wizard if images don't exist
  useEffect(() => {
    if (imagesExist === false && !isCheckingImages) {
      setShowSetup(true);
    }
  }, [imagesExist, isCheckingImages]);

  const handleStart = useCallback(async () => {
    try {
      await startVM();
    } catch (err) {
      console.error('Failed to start VM:', err);
    }
  }, [startVM]);

  const handleStop = useCallback(async () => {
    try {
      await stopVM();
    } catch (err) {
      console.error('Failed to stop VM:', err);
    }
  }, [stopVM]);

  const handleRestart = useCallback(async () => {
    try {
      await restartVM();
    } catch (err) {
      console.error('Failed to restart VM:', err);
    }
  }, [restartVM]);

  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
    checkImages();
  }, [checkImages]);

  if (showSetup) {
    return (
      <VMSetupWizard
        onComplete={handleSetupComplete}
        onDownload={downloadImages}
        imagesExist={imagesExist}
      />
    );
  }

  return (
    <div className={`vm-manager-panel ${className || ''}`}>
      <div className="vm-manager-header">
        <h2>A2R Virtual Machine</h2>
        <div className="vm-status-badge">
          <span className={`status-dot ${status?.state || 'stopped'}`} />
          <span className="status-text">
            {status?.state === 'running' ? 'Running' : 
             status?.state === 'starting' ? 'Starting...' :
             status?.state === 'stopping' ? 'Stopping...' :
             status?.state === 'error' ? 'Error' : 'Stopped'}
          </span>
        </div>
      </div>

      <VMControls
        isRunning={isRunning}
        isStarting={isStarting}
        isStopping={isStopping}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        disabled={!imagesExist}
      />

      {error && (
        <div className="vm-error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      )}

      <div className="vm-tabs">
        <button
          className={activeTab === 'status' ? 'active' : ''}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
        <button
          className={activeTab === 'commands' ? 'active' : ''}
          onClick={() => setActiveTab('commands')}
          disabled={!isRunning}
        >
          Commands
        </button>
        <button
          className={activeTab === 'logs' ? 'active' : ''}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
      </div>

      <div className="vm-tab-content">
        {activeTab === 'status' && (
          <VMStatus status={status} />
        )}

        {activeTab === 'commands' && isRunning && (
          <VMCommandExecutor
            onExecute={executeCommand}
            disabled={!isRunning}
          />
        )}

        {activeTab === 'commands' && !isRunning && (
          <div className="vm-not-running">
            <p>Start the VM to execute commands</p>
          </div>
        )}

        {activeTab === 'logs' && (
          <VMLogs />
        )}
      </div>
    </div>
  );
};

// VM Logs Component
const VMLogs: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Subscribe to VM logs via IPC
    const unsubscribe = window.electronAPI.on('vm:log', (data: unknown) => {
      const logEntry = typeof data === 'string' ? data : JSON.stringify(data);
      setLogs(prev => [...prev.slice(-100), logEntry]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="vm-logs">
      <div className="logs-header">
        <span>VM Logs</span>
        <button onClick={() => setLogs([])}>Clear</button>
      </div>
      <div className="logs-content">
        {logs.length === 0 ? (
          <p className="no-logs">No logs yet</p>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              <span className="log-timestamp">
                {new Date().toLocaleTimeString()}
              </span>
              <span className="log-message">{log}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VMManagerPanel;

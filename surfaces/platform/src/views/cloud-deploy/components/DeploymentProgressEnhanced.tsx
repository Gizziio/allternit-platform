/**
 * Enhanced Deployment Progress
 * 
 * Real-time deployment progress with:
 * - Live event log with timestamps
 * - Visual timeline with animated steps
 * - Estimated time remaining
 * - Auto-retry on error
 * - Download logs functionality
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { DeploymentStatus } from '../CloudDeployView';
import type { DeploymentEvent } from '../lib/api-client';
import './DeploymentProgressEnhanced.css';

interface DeploymentEventLog {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  step?: string;
  progress?: number;
}

interface DeploymentProgressEnhancedProps {
  status: DeploymentStatus;
  events?: DeploymentEvent[];
  onBack: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  mode: 'live' | 'demo';
  providerName?: string;
  error?: string | null;
}

export const DeploymentProgressEnhanced: React.FC<DeploymentProgressEnhancedProps> = ({
  status,
  events = [],
  onBack,
  onRetry,
  onCancel,
  mode,
  providerName = 'Cloud Provider',
  error,
}) => {
  const [eventLog, setEventLog] = useState<DeploymentEventLog[]>([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showLogPanel, setShowLogPanel] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<Date>(new Date());

  // Deployment steps configuration (provider-specific)
  const deploymentSteps = useMemo(() => [
    { id: 'init', label: 'Initializing', progress: 0, estimatedDuration: 5 },
    { id: 'validate', label: 'Validating Credentials', progress: 10, estimatedDuration: 10 },
    { id: 'ssh', label: 'Generating SSH Keys', progress: 15, estimatedDuration: 15 },
    { id: 'provision', label: `Provisioning ${providerName} VM`, progress: 35, estimatedDuration: 120 },
    { id: 'network', label: 'Configuring Network', progress: 60, estimatedDuration: 30 },
    { id: 'install', label: 'Installing Allternit Agent', progress: 75, estimatedDuration: 60 },
    { id: 'health', label: 'Health Checks', progress: 90, estimatedDuration: 20 },
    { id: 'complete', label: 'Deployment Complete', progress: 100, estimatedDuration: 5 },
  ], [providerName]);

  // Initialize event log with start event
  useEffect(() => {
    setEventLog([
      {
        id: 'start',
        timestamp: new Date(),
        type: 'info',
        message: `Deployment started using ${providerName}`,
        step: 'init',
        progress: 0,
      },
    ]);
    startTimeRef.current = new Date();
  }, [providerName]);

  // Process incoming events
  useEffect(() => {
    if (events.length === 0) return;

    const latestEvent = events[events.length - 1];
    const newLogEntry: DeploymentEventLog = {
      id: `${latestEvent.deployment_id}-${latestEvent.timestamp}`,
      timestamp: new Date(latestEvent.timestamp),
      type: getEventType(latestEvent.event_type),
      message: latestEvent.message,
      progress: latestEvent.progress,
    };

    setEventLog(prev => {
      // Avoid duplicates
      if (prev.some(e => e.id === newLogEntry.id)) return prev;
      return [...prev, newLogEntry];
    });

    // Update current step based on progress
    const stepIndex = deploymentSteps.findIndex((step, i) => {
      const nextStep = deploymentSteps[i + 1];
      return latestEvent.progress >= step.progress && 
             (!nextStep || latestEvent.progress < nextStep.progress);
    });
    if (stepIndex >= 0) {
      setCurrentStepIndex(stepIndex);
    }

    // Calculate estimated time remaining
    calculateTimeRemaining(latestEvent.progress);
  }, [events, deploymentSteps]);

  // Auto-scroll to bottom of log
  useEffect(() => {
    if (showLogPanel && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eventLog, showLogPanel]);

  const getEventType = (eventType: string): 'info' | 'success' | 'warning' | 'error' => {
    if (eventType.includes('error') || eventType.includes('failed')) return 'error';
    if (eventType.includes('complete') || eventType.includes('success')) return 'success';
    if (eventType.includes('warning')) return 'warning';
    return 'info';
  };

  const calculateTimeRemaining = (currentProgress: number) => {
    if (currentProgress >= 100) {
      setEstimatedTimeRemaining(0);
      return;
    }

    const elapsedSeconds = (Date.now() - startTimeRef.current.getTime()) / 1000;
    const progressRatio = currentProgress / 100;
    
    if (progressRatio > 0) {
      const totalEstimatedSeconds = elapsedSeconds / progressRatio;
      const remainingSeconds = totalEstimatedSeconds - elapsedSeconds;
      setEstimatedTimeRemaining(Math.max(0, Math.round(remainingSeconds)));
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  const downloadLogs = () => {
    const logContent = eventLog.map(event => 
      `[${formatTimestamp(event.timestamp)}] [${event.type.toUpperCase()}] ${event.message}`
    ).join('\n');

    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${status.id}-${new Date().toISOString().split('T')[0]}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isComplete = status.progress >= 100;
  const hasError = error || status.errors.length > 0;
  const isInProgress = !isComplete && !hasError;

  return (
    <div className="deployment-progress-enhanced">
      {/* Mode Indicator */}
      <div className={`mode-indicator mode-${mode}`}>
        {mode === 'live' ? (
          <>
            <span className="live-dot" />
            <span>LIVE - Connected to {providerName}</span>
          </>
        ) : (
          <>
            <span>⚠️</span>
            <span>DEMO MODE - UI Preview Only</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="progress-header">
        <div>
          <h2>
            {isComplete ? '✅ Deployment Complete' : 
             hasError ? '❌ Deployment Failed' : 
             '🚀 Deploying Allternit Instance'}
          </h2>
          <p className="deployment-id">Deployment ID: <code>{status.id}</code></p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-icon"
            onClick={() => setShowLogPanel(!showLogPanel)}
            title={showLogPanel ? 'Hide logs' : 'Show logs'}
          >
            {showLogPanel ? '📋' : '📄'}
          </button>
          <button 
            className="btn-icon"
            onClick={downloadLogs}
            title="Download logs"
          >
            💾
          </button>
        </div>
      </div>

      <div className="progress-layout">
        {/* Left Panel - Progress & Timeline */}
        <div className="progress-main">
          {/* Progress Circle */}
          <div className="progress-circle-container">
            <div className="progress-circle">
              <svg viewBox="0 0 100 100">
                <circle className="progress-bg" cx="50" cy="50" r="45" />
                <circle 
                  className={`progress-bar ${hasError ? 'error' : ''}`}
                  cx="50" 
                  cy="50" 
                  r="45"
                  style={{
                    strokeDashoffset: 283 - (283 * status.progress) / 100,
                  }}
                />
              </svg>
              <div className="progress-text">
                <span className="percentage">{status.progress}%</span>
                {estimatedTimeRemaining !== null && isInProgress && (
                  <span className="time-remaining">
                    ~{formatDuration(estimatedTimeRemaining)} left
                  </span>
                )}
              </div>
            </div>
            
            <div className="progress-status">
              <div className={`status-badge ${hasError ? 'error' : isComplete ? 'success' : 'active'}`}>
                {hasError ? '● Failed' : isComplete ? '✓ Complete' : '● In Progress'}
              </div>
              <p className="status-message">{status.message}</p>
              {hasError && (
                <div className="error-details">
                  <p>{error || status.errors[0]}</p>
                </div>
              )}
            </div>
          </div>

          {/* Step Timeline */}
          <div className="step-timeline-enhanced">
            <h4>Deployment Steps</h4>
            <div className="timeline">
              {deploymentSteps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isActive = index === currentStepIndex;
                const isPending = index > currentStepIndex;

                return (
                  <div 
                    key={step.id}
                    className={`timeline-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}
                  >
                    <div className="timeline-marker">
                      {isCompleted ? (
                        <span className="marker-check">✓</span>
                      ) : isActive ? (
                        <span className="marker-active">
                          <span className="pulse" />
                        </span>
                      ) : (
                        <span className="marker-pending">{index + 1}</span>
                      )}
                    </div>
                    <div className="timeline-content">
                      <span className="step-label">{step.label}</span>
                      <span className="step-duration">~{step.estimatedDuration}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="progress-actions">
            {hasError ? (
              <>
                <button className="btn-secondary" onClick={onBack}>
                  ← Back
                </button>
                {onRetry && (
                  <button 
                    className="btn-primary"
                    onClick={handleRetry}
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <>
                        <span className="spinner-sm" />
                        Retrying...
                      </>
                    ) : (
                      '🔄 Retry Deployment'
                    )}
                  </button>
                )}
              </>
            ) : isComplete ? (
              <button className="btn-primary" onClick={onBack}>
                Deploy Another Instance
              </button>
            ) : (
              <>
                <button className="btn-secondary" onClick={onBack}>
                  ← Cancel
                </button>
                {onCancel && (
                  <button className="btn-danger" onClick={onCancel}>
                    Stop Deployment
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Panel - Event Log */}
        {showLogPanel && (
          <div className="event-log-panel">
            <div className="log-header">
              <h4>📜 Event Log</h4>
              <span className="log-count">{eventLog.length} events</span>
            </div>
            <div className="log-content">
              {eventLog.length === 0 ? (
                <div className="log-empty">
                  <p>Waiting for events...</p>
                </div>
              ) : (
                <>
                  {eventLog.map((event, index) => (
                    <div 
                      key={event.id}
                      className={`log-entry ${event.type}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="log-time">{formatTimestamp(event.timestamp)}</span>
                      <span className={`log-type ${event.type}`}>
                        {event.type === 'info' && 'ℹ'}
                        {event.type === 'success' && '✓'}
                        {event.type === 'warning' && '⚠'}
                        {event.type === 'error' && '✗'}
                      </span>
                      <span className="log-message">{event.message}</span>
                    </div>
                  ))}
                  {isInProgress && (
                    <div className="log-entry loading">
                      <span className="log-time">{formatTimestamp(new Date())}</span>
                      <span className="log-type">
                        <span className="dots">...</span>
                      </span>
                      <span className="log-message">Waiting for next event...</span>
                    </div>
                  )}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper for useMemo
const useMemo = React.useMemo;

export default DeploymentProgressEnhanced;

/**
 * Deployment Progress
 * 
 * Real-time deployment progress tracker.
 * HONEST about mode: Live (real events) vs Demo (simulated UI)
 */

import React from 'react';
import type { DeploymentStatus } from '../CloudDeployView';

interface DeploymentProgressProps {
  status: DeploymentStatus;
  onBack: () => void;
  mode: 'live' | 'demo';  // Explicit mode declaration
}

export const DeploymentProgress: React.FC<DeploymentProgressProps> = ({ 
  status, 
  onBack,
  mode 
}) => {
  const steps = [
    { progress: 10, label: 'Validating credentials' },
    { progress: 30, label: 'Provisioning VM' },
    { progress: 50, label: 'Instance ready' },
    { progress: 60, label: 'Installing Allternit' },
    { progress: 75, label: 'Configuring network' },
    { progress: 90, label: 'Health checks' },
    { progress: 100, label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(
    (step, i) => status.progress >= step.progress && 
    (steps[i + 1] ? status.progress < steps[i + 1].progress : true)
  );

  return (
    <div className="deployment-progress">
      {/* Mode Indicator - CRITICAL for honesty */}
      <div className={`mode-indicator mode-${mode}`}>
        {mode === 'live' ? (
          <span>🔴 LIVE - Connected to provider</span>
        ) : (
          <span>⚠️ DEMO MODE - UI Preview Only (not connected to provider)</span>
        )}
      </div>

      <h2>🚀 Deploying Your Allternit Instance</h2>
      
      {mode === 'demo' && (
        <p className="demo-notice">
          This is a UI preview. In production, this would show real deployment 
          events from your cloud provider. Backend integration required for live deployments.
        </p>
      )}

      <div className="progress-container">
        {/* Progress Circle */}
        <div className="progress-circle">
          <svg viewBox="0 0 100 100">
            <circle
              className="progress-bg"
              cx="50"
              cy="50"
              r="45"
            />
            <circle
              className="progress-bar"
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
          </div>
        </div>

        {/* Status Message */}
        <div className="status-message">
          {mode === 'live' && <div className="spinner" />}
          <p>{status.message}</p>
        </div>

        {/* Step Timeline */}
        <div className="step-timeline">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`timeline-step ${index <= currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}`}
            >
              <div className="step-dot">
                {index < currentStepIndex ? '✓' : index === currentStepIndex ? '●' : '○'}
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Deployment ID */}
        <div className="deployment-id">
          <span>Deployment ID:</span>
          <code>{status.id}</code>
        </div>

        {/* Event Feed (Live Mode Only) */}
        {mode === 'live' && (
          <div className="event-feed">
            <h4>Deployment Events</h4>
            <div className="event-list">
              <div className="event-item">
                <span className="event-time">Just now</span>
                <span className="event-message">{status.message}</span>
              </div>
              {/* In production, populate from real event stream */}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="progress-actions">
          {mode === 'live' ? (
            <button 
              type="button" 
              className="btn-secondary"
              onClick={onBack}
              disabled={status.progress < 100}
            >
              Cancel Deployment
            </button>
          ) : (
            <button 
              type="button" 
              className="btn-primary"
              onClick={onBack}
            >
              Back to Deploy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentProgress;

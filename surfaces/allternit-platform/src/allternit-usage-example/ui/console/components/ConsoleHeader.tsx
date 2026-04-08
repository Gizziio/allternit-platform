/**
 * Console Header
 * 
 * Always-visible header showing:
 * - Console title
 * - Live signals (providers, instances, swarms, event bus)
 * - Environment switch (Dev/Staging/Prod)
 * - Primary CTA (Deploy)
 */

import React from 'react';
import type { LiveSignals } from './ConsoleLayout';

interface ConsoleHeaderProps {
  liveSignals: LiveSignals;
  environment: 'development' | 'staging' | 'production';
  onDeployClick: () => void;
}

export const ConsoleHeader: React.FC<ConsoleHeaderProps> = ({
  liveSignals,
  environment,
  onDeployClick,
}) => {
  return (
    <header className="console-header">
      {/* Left: Title */}
      <div className="console-header-left">
        <h1 className="console-title">
          <span className="title-icon">☁️</span>
          A2R Console
        </h1>
        <span className="control-plane-badge">Control Plane</span>
      </div>

      {/* Center: Live Signals */}
      <div className="console-header-center">
        <div className="live-signal">
          <span className="signal-value">{liveSignals.connectedProviders}</span>
          <span className="signal-label">Providers</span>
        </div>
        <div className="live-signal">
          <span className={`signal-value ${liveSignals.healthyInstances === liveSignals.totalInstances ? 'healthy' : 'warning'}`}>
            {liveSignals.healthyInstances}/{liveSignals.totalInstances}
          </span>
          <span className="signal-label">Instances</span>
        </div>
        <div className="live-signal">
          <span className="signal-value">{liveSignals.activeSwarms}</span>
          <span className="signal-label">Swarms</span>
        </div>
        <div className="live-signal">
          <span className={`signal-status ${liveSignals.eventBusConnected ? 'connected' : 'disconnected'}`}>
            {liveSignals.eventBusConnected ? '●' : '○'}
          </span>
          <span className="signal-label">Event Bus</span>
        </div>
      </div>

      {/* Right: Env Switch + CTA */}
      <div className="console-header-right">
        <select 
          className="env-switch"
          value={environment}
          disabled
        >
          <option value="development">Dev</option>
          <option value="staging">Staging</option>
          <option value="production">Prod</option>
        </select>
        
        <button 
          className="btn-primary btn-deploy"
          onClick={onDeployClick}
        >
          + Deploy
        </button>
      </div>
    </header>
  );
};

export default ConsoleHeader;

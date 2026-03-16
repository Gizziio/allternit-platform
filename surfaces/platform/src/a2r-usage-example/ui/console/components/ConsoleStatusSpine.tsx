/**
 * Console Status Spine
 * 
 * Persistent status strip (bottom or side) showing:
 * - Last deploy status
 * - Active incident indicator
 * - Cost today / month estimate
 * - Token budget warnings
 * 
 * This is what makes it feel like a control plane.
 */

import React, { useState, useEffect } from 'react';

export const ConsoleStatusSpine: React.FC = () => {
  const [status, setStatus] = useState({
    lastDeploy: { status: 'success', time: '2m ago' },
    activeIncidents: 0,
    costToday: 2.45,
    costMonth: 73.50,
    tokenBudget: { used: 450000, limit: 1000000 },
  });

  return (
    <div className="console-status-spine">
      {/* Last Deploy Status */}
      <div className="spine-item">
        <span className="spine-label">Last Deploy</span>
        <span className={`spine-value deploy-${status.lastDeploy.status}`}>
          {status.lastDeploy.status === 'success' ? '✓' : '✗'} {status.lastDeploy.time}
        </span>
      </div>

      {/* Active Incidents */}
      <div className="spine-item">
        <span className="spine-label">Incidents</span>
        <span className={`spine-value ${status.activeIncidents > 0 ? 'incident' : 'healthy'}`}>
          {status.activeIncidents > 0 ? `⚠️ ${status.activeIncidents}` : 'None'}
        </span>
      </div>

      {/* Cost */}
      <div className="spine-item">
        <span className="spine-label">Cost</span>
        <span className="spine-value cost">
          ${status.costToday.toFixed(2)} today / ${status.costMonth.toFixed(2)} mo
        </span>
      </div>

      {/* Token Budget */}
      <div className="spine-item">
        <span className="spine-label">Tokens</span>
        <span className={`spine-value ${status.tokenBudget.used / status.tokenBudget.limit > 0.8 ? 'warning' : 'healthy'}`}>
          {(status.tokenBudget.used / 1000).toFixed(0)}k / {(status.tokenBudget.limit / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Execution Plane Indicator */}
      <div className="spine-item execution-plane">
        <span className="spine-label">Execution Plane</span>
        <span className="spine-value">
          <span className="plane-indicator control-plane">●</span> Control
          <span className="plane-indicator execution-plane">●</span> Execution
        </span>
      </div>
    </div>
  );
};

export default ConsoleStatusSpine;

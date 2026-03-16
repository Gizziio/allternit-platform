/**
 * VM Status Component
 * 
 * Displays detailed VM status information.
 */

import React from 'react';
import type { VMInfo } from '../../shared/types';

export interface VMStatusProps {
  status: VMInfo | null;
}

export const VMStatus: React.FC<VMStatusProps> = ({ status }) => {
  if (!status) {
    return (
      <div className="vm-status">
        <p className="no-status">No status available</p>
      </div>
    );
  }

  const formatUptime = (uptime?: number): string => {
    if (uptime === undefined) return 'N/A';
    
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="vm-status">
      <h3>VM Status</h3>
      
      <div className="status-grid">
        <div className="status-item">
          <span className="status-label">State</span>
          <span className={`status-value state-${status.state}`}>
            {status.state}
          </span>
        </div>

        <div className="status-item">
          <span className="status-label">VM Name</span>
          <span className="status-value">{status.vmName}</span>
        </div>

        {status.pid && (
          <div className="status-item">
            <span className="status-label">Process ID</span>
            <span className="status-value">{status.pid}</span>
          </div>
        )}

        <div className="status-item">
          <span className="status-label">Socket Path</span>
          <span className="status-value mono">{status.socketPath}</span>
        </div>

        <div className="status-item">
          <span className="status-label">VSOCK Port</span>
          <span className="status-value">{status.vsockPort}</span>
        </div>

        {status.uptime !== undefined && (
          <div className="status-item">
            <span className="status-label">Uptime</span>
            <span className="status-value">{formatUptime(status.uptime)}</span>
          </div>
        )}

        {status.version && (
          <div className="status-item">
            <span className="status-label">Version</span>
            <span className="status-value">{status.version}</span>
          </div>
        )}
      </div>

      {status.error && (
        <div className="status-error">
          <h4>Error</h4>
          <p>{status.error}</p>
        </div>
      )}
    </div>
  );
};

export default VMStatus;

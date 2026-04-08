/**
 * Allternit Operator Status Indicator
 * Displays the availability and capabilities of Allternit Operator services
 */

import React, { useState } from 'react';
import { 
  Globe, 
  Desktop, 
  Eye, 
  ArrowsHorizontal, 
  CheckCircle, 
  XCircle, 
  Circle,
  Spinner,
  Robot
} from '@phosphor-icons/react';
import { useAllternitOperatorStatus } from '@/lib/services/useAllternitOperatorStatus';

export function AllternitOperatorStatus() {
  const {
    status,
    capabilities,
    lastChecked,
    error,
    refresh,
    isAvailable,
    hasBrowser,
    hasDesktop,
    hasVision,
    hasParallel,
  } = useAllternitOperatorStatus(30000); // Check every 30 seconds

  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'var(--sand-500)'; // sand accent
      case 'offline': return 'var(--sand-700)'; // deep brown
      case 'error': return 'var(--sand-600)'; // amber-ish
      case 'checking': return 'var(--sand-400)'; // light sand
      default: return 'var(--text-tertiary)';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'online': return <CheckCircle size={14} weight="fill" color={getStatusColor()} />;
      case 'offline': return <XCircle size={14} weight="fill" color={getStatusColor()} />;
      case 'error': return <XCircle size={14} weight="fill" color={getStatusColor()} />;
      case 'checking': return <Spinner size={14} className="animate-spin" color={getStatusColor()} />;
      default: return <Circle size={14} color={getStatusColor()} />;
    }
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Compact Status Indicator */}
      <button
        onClick={refresh}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)'
        }}
        title="Allternit Operator Status - Click to refresh"
      >
        <Robot size={16} style={{ color: 'var(--text-secondary)' }} />
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Allternit {status === 'online' ? 'Ready' : status}
          </span>
        </div>
      </button>

      {/* Expanded Status Panel */}
      {isExpanded && (
        <div 
          className="absolute top-full right-0 mt-2 w-72 p-4 rounded-xl shadow-lg z-50"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Robot size={20} style={{ color: 'var(--accent-chat)' }} />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Allternit Operator</span>
            </div>
            <button
              onClick={refresh}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Refresh
            </button>
          </div>

          {/* Status Badge */}
          <div 
            className="flex items-center gap-2 mb-4 p-2 rounded-lg"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {getStatusIcon()}
            <span className="text-sm font-medium capitalize" style={{ color: getStatusColor() }}>
              {status}
            </span>
            {lastChecked && (
              <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </div>

          {error && (
            <div 
              className="mb-3 p-2 rounded-lg border"
              style={{ 
                background: 'rgba(154, 118, 88, 0.1)',
                borderColor: 'rgba(154, 118, 88, 0.2)'
              }}
            >
              <p className="text-xs" style={{ color: 'var(--sand-600)' }}>{error}</p>
            </div>
          )}

          {/* Capabilities Grid */}
          <div className="space-y-2">
            <p 
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              Available Services
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              {/* Browser Automation */}
              <CapabilityItem
                icon={Globe}
                label="Browser"
                available={hasBrowser}
                sublabel={capabilities.browserUse ? 'agent' : capabilities.playwright ? 'fast' : 'off'}
              />

              {/* Desktop Control */}
              <CapabilityItem
                icon={Desktop}
                label="Desktop"
                available={hasDesktop}
                sublabel="control"
              />

              {/* Vision */}
              <CapabilityItem
                icon={Eye}
                label="Vision"
                available={hasVision}
                sublabel="Allternit Vision"
              />

              {/* Parallel Execution */}
              <CapabilityItem
                icon={ArrowsHorizontal}
                label="Parallel"
                available={hasParallel}
                sublabel="variants"
              />
            </div>
          </div>

          {/* Port Info */}
          <div 
            className="mt-3 pt-3"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Port: <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>3000</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface CapabilityItemProps {
  icon: any;
  label: string;
  available: boolean;
  sublabel?: string;
}

function CapabilityItem({ icon: Icon, label, available, sublabel }: CapabilityItemProps) {
  return (
    <div 
      className="flex items-center gap-2 p-2 rounded-lg border"
      style={{
        background: available 
          ? 'rgba(176, 141, 110, 0.1)' // sand-500 with opacity
          : 'var(--bg-secondary)',
        borderColor: available 
          ? 'rgba(176, 141, 110, 0.3)' 
          : 'var(--border-subtle)',
        opacity: available ? 1 : 0.6
      }}
    >
      <Icon 
        size={16} 
        weight={available ? 'duotone' : 'regular'}
        style={{ color: available ? 'var(--sand-500)' : 'var(--text-tertiary)' }}
      />
      <div className="flex flex-col">
        <span 
          className="text-xs font-medium"
          style={{ color: available ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
        >
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] capitalize" style={{ color: 'var(--text-tertiary)' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

export default AllternitOperatorStatus;

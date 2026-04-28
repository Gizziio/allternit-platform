/**
 * SwarmMetrics - Metrics display panel
 * 
 * Features:
 * - Monospace numbers
 * - Real-time counters
 * - Compact layout
 */

import React from 'react';
import { TEXT, BACKGROUND } from '@/design/allternit.tokens';
import { SwarmMetrics as SwarmMetricsType } from '../types';

interface SwarmMetricsProps {
  metrics: SwarmMetricsType;
  modeColors: {
    accent: string;
  };
}

export function SwarmMetrics({ metrics, modeColors }: SwarmMetricsProps) {
  return (
    <div 
      className="w-64 border-l overflow-auto p-4 font-mono text-sm"
      style={{ 
        background: BACKGROUND.primary,
        borderColor: 'var(--ui-border-muted)',
      }}
    >
      <h3 
        className="mb-4 text-xs uppercase tracking-wider font-bold"
        style={{ color: TEXT.tertiary }}
      >
        Metrics
      </h3>
      
      <div className="space-y-4">
        <MetricItem label="THROUGHPUT" value={`${metrics.throughput.toFixed(1)} t/s`} />
        <MetricItem label="LATENCY" value={`${metrics.avgLatency} ms`} />
        <MetricItem label="TOKENS/MIN" value={`${(metrics.tokensPerMinute / 1000).toFixed(1)}k`} />
        <MetricItem label="COST/HR" value={`$${metrics.costPerHour.toFixed(2)}`} />
        <MetricItem 
          label="ACTIVE" 
          value={metrics.activeAgents.toString()} 
          color={modeColors.accent} 
        />
      </div>
    </div>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  color?: string;
}

function MetricItem({ label, value, color }: MetricItemProps) {
  return (
    <div>
      <div 
        className="text-[10px] font-bold tracking-wider mb-1"
        style={{ color: TEXT.tertiary }}
      >
        {label}
      </div>
      <div 
        className="text-xl font-bold"
        style={{ color: color || TEXT.primary }}
      >
        {value}
      </div>
    </div>
  );
}

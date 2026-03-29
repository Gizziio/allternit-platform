/**
 * Stats Bar - Real-time metrics display
 *
 * Shows key swarm metrics in a compact bar format
 */

import React from 'react';
import {
  Circle,
  Graph,
  CheckCircle,
  Clock,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { TEXT, BACKGROUND, BORDER, STATUS } from '@/design/a2r.tokens';
import { SwarmMetrics } from '../types';

interface StatsBarProps {
  metrics: SwarmMetrics;
  modeColors: {
    accent: string;
  };
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function StatsBar({ metrics, modeColors, isRefreshing, onRefresh }: StatsBarProps) {
  const stats = [
    {
      label: 'Active Agents',
      value: metrics.activeAgents,
      color: modeColors.accent,
      Icon: Circle,
    },
    {
      label: 'Active Threads',
      value: metrics.activeThreads,
      color: modeColors.accent,
      Icon: Graph,
    },
    {
      label: 'Completed',
      value: metrics.completedThreads,
      color: STATUS.success,
      Icon: CheckCircle,
    },
    {
      label: 'Queued',
      value: metrics.queuedThreads,
      color: TEXT.tertiary,
      Icon: Clock,
    },
  ];

  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        background: BACKGROUND.tertiary,
        borderColor: BORDER.subtle,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          {stats.map(({ label, value, color, Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${color}20` }}
              >
                <Icon size={14} color={color} weight="duotone" />
              </div>
              <div>
                <div className="text-xl font-bold font-mono" style={{ color }}>
                  {value}
                </div>
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: TEXT.tertiary }}
                >
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6">
          {/* Cost */}
          <div className="text-right">
            <div className="text-lg font-bold font-mono" style={{ color: TEXT.primary }}>
              ${metrics.totalCost.toFixed(2)}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT.tertiary }}>
              Total Cost
            </div>
          </div>

          {/* Tokens */}
          <div className="text-right">
            <div className="text-lg font-bold font-mono" style={{ color: TEXT.primary }}>
              {(metrics.totalTokens / 1000).toFixed(1)}k
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: TEXT.tertiary }}>
              Total Tokens
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
            style={{
              background: BACKGROUND.secondary,
              border: `1px solid ${BORDER.subtle}`,
            }}
            title="Refresh"
          >
            <ArrowsClockwise
              size={14}
              color={TEXT.secondary}
              weight="regular"
              style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

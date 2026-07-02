/**
 * Trend Chart Component
 * 
 * Line chart displaying historical confidence trends over time
 * with interactive tooltips and threshold indicators.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface DataPoint {
  timestamp: string;
  confidence: number;
  wihId?: string;
}

export interface TrendChartProps {
  data: DataPoint[];
  threshold?: number;
  height?: number;
  showPoints?: boolean;
  onPointClick?: (point: DataPoint) => void;
}

const getLineColor = (confidence: number): string => {
  if (confidence >= 0.7) return 'var(--status-success)';
  if (confidence >= 0.5) return 'var(--status-warning)';
  return 'var(--status-error)';
};

const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  threshold = 0.7,
  height = 200,
  showPoints = true,
  onPointClick,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  
  const stats = useMemo(() => {
    if (data.length === 0) return { avg: 0, min: 0, max: 0, trend: 'neutral' as const };
    
    const confidences = data.map(d => d.confidence);
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);
    
    const recent = confidences.slice(-5);
    const older = confidences.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    
    const trend = recentAvg > olderAvg + 0.05 ? 'up' : recentAvg < olderAvg - 0.05 ? 'down' : 'neutral';
    
    return { avg, min, max, trend };
  }, [data]);

  const chartWidth = 800;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const xScale = useCallback((index: number) => padding.left + (index / (Math.max(data.length - 1, 1))) * innerWidth, [padding.left, data.length, innerWidth]);
  const yScale = useCallback((confidence: number) => padding.top + innerHeight - confidence * innerHeight, [padding.top, innerHeight]);

  const linePath = useMemo(() => {
    if (data.length === 0) return '';
    return data.map((point, i) => {
      const x = xScale(i);
      const y = yScale(point.confidence);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [data, xScale, yScale]);

  const trendColor = getLineColor(stats.avg);

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setHoveredIndex(index);
  };

  if (data.length === 0) {
    return (
      <div className="p-5 rounded-xl border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="m-0 text-[14px] font-semibold text-[var(--ui-text-primary)]">Confidence Trend</h4>
        </div>
        <div className="flex items-center justify-center text-[var(--ui-text-muted)]" style={{ height }}>
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl border border-solid border-[var(--ui-border-default)] bg-[var(--surface-panel)]">
      <div className="flex items-center justify-between mb-4">
        <h4 className="m-0 text-[14px] font-semibold text-[var(--ui-text-primary)]">Confidence Trend</h4>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span 
              className="text-[16px] font-semibold tabular-nums"
              style={{ color: stats.trend === 'up' ? 'var(--status-success)' : stats.trend === 'down' ? 'var(--status-error)' : 'var(--ui-text-primary)' }}
            >
              {stats.trend === 'up' && '↑ '}{stats.trend === 'down' && '↓ '}{Math.round(stats.avg * 100)}%
            </span>
            <span className="text-[12px] text-[var(--ui-text-muted)]">Average</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[16px] font-semibold text-[var(--ui-text-primary)] tabular-nums">{Math.round(stats.min * 100)}%</span>
            <span className="text-[12px] text-[var(--ui-text-muted)]">Min</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[16px] font-semibold text-[var(--ui-text-primary)] tabular-nums">{Math.round(stats.max * 100)}%</span>
            <span className="text-[12px] text-[var(--ui-text-muted)]">Max</span>
          </div>
        </div>
      </div>

      <div className="relative w-full" style={{ height }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="size-full overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map(tick => (
            <g key={`tick-${tick}`}>
              <line
                x1={padding.left}
                y1={yScale(tick)}
                x2={chartWidth - padding.right}
                y2={yScale(tick)}
                className="stroke-[var(--ui-border-default)] stroke-1"
                strokeDasharray="4,4"
              />
              <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" className="fill-[var(--ui-text-muted)] text-[11px] font-medium">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            y1={yScale(threshold)}
            x2={chartWidth - padding.right}
            y2={yScale(threshold)}
            className="stroke-[var(--status-warning)] stroke-2"
            strokeDasharray="8,4"
          />

          <path d={linePath} fill="none" stroke={trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {showPoints && data.map((point, i) => (
            <circle
              key={`${point.timestamp}-${i}`}
              cx={xScale(i)}
              cy={yScale(point.confidence)}
              r={hoveredIndex === i ? 6 : 4}
              className="fill-[var(--surface-panel)] transition-all duration-200 cursor-pointer"
              stroke={getLineColor(point.confidence)}
              strokeWidth={hoveredIndex === i ? 3 : 2}
              onMouseEnter={(e) => handleMouseMove(e, i)}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onMouseLeave={() => { setHoveredIndex(null); setTooltipPos(null); }}
              onClick={() => onPointClick?.(point)}
            />
          ))}

          {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
            <text key={`label-${i}`} x={xScale(i)} y={chartHeight - 10} textAnchor="middle" className="fill-[var(--ui-text-muted)] text-[11px]">
              {formatDate(data[i].timestamp)}
            </text>
          ))}
        </svg>

        {hoveredIndex !== null && tooltipPos && (
          <div 
            className="absolute -translate-x-1/2 bg-[var(--surface-panel)] border border-solid border-[#333] rounded-lg p-[12px_16px] pointer-events-none z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] min-w-[140px]"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 60,
            }}
          >
            <div className="text-[12px] text-[var(--ui-text-muted)] mb-1">
              {formatDate(data[hoveredIndex].timestamp)} at {formatTime(data[hoveredIndex].timestamp)}
            </div>
            <div 
              className="text-[18px] font-bold tabular-nums"
              style={{ color: getLineColor(data[hoveredIndex].confidence) }}
            >
              {Math.round(data[hoveredIndex].confidence * 100)}% Confidence
            </div>
            {data[hoveredIndex].wihId && (
              <div className="text-[12px] text-[var(--ui-text-muted)] mt-1 font-mono">{data[hoveredIndex].wihId}</div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-solid border-[#333]">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ui-text-muted)]">
          <div className="w-5 h-0.5" style={{ background: trendColor }} />
          Confidence
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ui-text-muted)]">
          <div className="w-5 h-0.5 bg-[repeating-linear-gradient(to_right,#eab308_0px,#eab308_4px,transparent_4px,transparent_8px)]" />
          Threshold ({Math.round(threshold * 100)}%)
        </div>
      </div>
    </div>
  );
};

export default TrendChart;

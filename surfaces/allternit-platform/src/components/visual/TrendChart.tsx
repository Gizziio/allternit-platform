/**
 * Trend Chart Component
 * 
 * Line chart displaying historical confidence trends over time
 * with interactive tooltips and threshold indicators.
 */

import React, { useMemo, useState } from 'react';

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

  const xScale = (index: number) => padding.left + (index / (Math.max(data.length - 1, 1))) * innerWidth;
  const yScale = (confidence: number) => padding.top + innerHeight - confidence * innerHeight;

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
      <div style={{ background: 'var(--surface-panel)', border: '1px solid var(--ui-border-default)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>Confidence Trend</h4>
        </div>
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ui-text-muted)' }}>
          No data available
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface-panel)', border: '1px solid var(--ui-border-default)', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>Confidence Trend</h4>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: stats.trend === 'up' ? 'var(--status-success)' : stats.trend === 'down' ? 'var(--status-error)' : 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {stats.trend === 'up' && '↑ '}{stats.trend === 'down' && '↓ '}{Math.round(stats.avg * 100)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Average</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(stats.min * 100)}%</span>
            <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Min</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(stats.max * 100)}%</span>
            <span style={{ fontSize: '11px', color: 'var(--ui-text-muted)' }}>Max</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', height, width: '100%' }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(tick => (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={yScale(tick)}
                x2={chartWidth - padding.right}
                y2={yScale(tick)}
                stroke="var(--ui-border-default)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" fill="var(--ui-text-muted)" fontSize="11" fontWeight="500">
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            y1={yScale(threshold)}
            x2={chartWidth - padding.right}
            y2={yScale(threshold)}
            stroke="var(--status-warning)"
            strokeWidth={2}
            strokeDasharray="8,4"
          />

          <path d={linePath} fill="none" stroke={trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          {showPoints && data.map((point, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(point.confidence)}
              r={hoveredIndex === i ? 6 : 4}
              fill="var(--surface-panel)"
              stroke={getLineColor(point.confidence)}
              strokeWidth={hoveredIndex === i ? 3 : 2}
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => handleMouseMove(e, i)}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onMouseLeave={() => { setHoveredIndex(null); setTooltipPos(null); }}
              onClick={() => onPointClick?.(point)}
            />
          ))}

          {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
            <text key={i} x={xScale(i)} y={chartHeight - 10} textAnchor="middle" fill="var(--ui-text-muted)" fontSize="11">
              {formatDate(data[i].timestamp)}
            </text>
          ))}
        </svg>

        {hoveredIndex !== null && tooltipPos && (
          <div style={{
            position: 'absolute',
            left: tooltipPos.x,
            top: tooltipPos.y - 60,
            transform: 'translateX(-50%)',
            background: 'var(--surface-panel)',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '12px 16px',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            minWidth: '140px',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginBottom: '4px' }}>
              {formatDate(data[hoveredIndex].timestamp)} at {formatTime(data[hoveredIndex].timestamp)}
            </div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 700, 
              color: getLineColor(data[hoveredIndex].confidence),
              fontVariantNumeric: 'tabular-nums'
            }}>
              {Math.round(data[hoveredIndex].confidence * 100)}% Confidence
            </div>
            {data[hoveredIndex].wihId && (
              <div style={{ fontSize: '11px', color: 'var(--ui-text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>{data[hoveredIndex].wihId}</div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ui-text-muted)' }}>
          <div style={{ width: '20px', height: '2px', background: trendColor }} />
          Confidence
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ui-text-muted)' }}>
          <div style={{ width: '20px', height: '2px', background: 'repeating-linear-gradient(to right, #eab308 0px, #eab308 4px, transparent 4px, transparent 8px)' }} />
          Threshold ({Math.round(threshold * 100)}%)
        </div>
      </div>
    </div>
  );
};

export default TrendChart;

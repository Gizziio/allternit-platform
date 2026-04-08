/**
 * History View - Metrics over time visualization
 * 
 * Features:
 * - Multiple chart types (line, area, bar)
 * - Time range selection (1h, 6h, 24h, 7d)
 * - Metric selection (toggle individual metrics)
 * - Statistics panel (min/max/avg/current)
 * - Export functionality
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartLine, FileCsv, FileCode } from '@phosphor-icons/react';
import { TEXT, MODE_COLORS, BACKGROUND, BORDER, STATUS } from '@/design/allternit.tokens';
import type { MetricsDataPoint } from '../types';
import { exportAndDownloadMetrics, copyToClipboard } from '../lib/export-utils';

type ChartType = 'line' | 'area' | 'bar';
type TimeRange = '1h' | '6h' | '24h' | '7d';

interface HistoryViewProps {
  data: MetricsDataPoint[];
  modeColors: { accent: string };
}

interface MetricConfig {
  key: keyof Omit<MetricsDataPoint, 'timestamp' | 'bucketStart'>;
  label: string;
  color: string;
  unit: string;
  formatter: (v: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'activeAgents',
    label: 'Active Agents',
    color: '#c17817',
    unit: '',
    formatter: (v) => v.toString(),
  },
  {
    key: 'totalTokens',
    label: 'Tokens',
    color: STATUS.info,
    unit: '',
    formatter: (v) => v > 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString(),
  },
  {
    key: 'totalCost',
    label: 'Cost',
    color: STATUS.success,
    unit: '$',
    formatter: (v) => `$${v.toFixed(2)}`,
  },
  {
    key: 'throughput',
    label: 'Throughput',
    color: '#a78bfa',
    unit: 't/s',
    formatter: (v) => `${v.toFixed(1)} t/s`,
  },
  {
    key: 'avgLatency',
    label: 'Latency',
    color: STATUS.warning,
    unit: 'ms',
    formatter: (v) => `${Math.round(v)} ms`,
  },
];

export function HistoryView({ data, modeColors }: HistoryViewProps) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    new Set(['activeAgents', 'throughput'])
  );
  const [isExporting, setIsExporting] = useState(false);

  // Filter data by time range
  const filteredData = useMemo(() => {
    const now = Date.now();
    const rangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[timeRange];

    const cutoff = now - rangeMs;
    return data.filter(d => new Date(d.timestamp).getTime() > cutoff);
  }, [data, timeRange]);

  // Format data for charts
  const chartData = useMemo(() => {
    return filteredData.map(d => ({
      ...d,
      time: formatTimeLabel(d.timestamp, timeRange),
      // Normalize values for dual-axis display
      activeAgentsNormalized: d.activeAgents * 10, // Scale up for visibility
      totalTokensNormalized: d.totalTokens / 1000,
      totalCostNormalized: d.totalCost * 100,
      throughputNormalized: d.throughput * 10,
      avgLatencyNormalized: d.avgLatency / 10,
    }));
  }, [filteredData, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const result: Record<string, { min: number; max: number; avg: number; current: number }> = {};
    
    METRICS.forEach(metric => {
      const values = filteredData.map(d => d[metric.key] as number);
      if (values.length === 0) {
        result[metric.key] = { min: 0, max: 0, avg: 0, current: 0 };
        return;
      }
      
      result[metric.key] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        current: values[values.length - 1],
      };
    });
    
    return result;
  }, [filteredData]);

  const toggleMetric = useCallback((key: string) => {
    setVisibleMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      exportAndDownloadMetrics(filteredData, format, {
        filename: `swarm-metrics-${timeRange}`,
      });
    } finally {
      setIsExporting(false);
    }
  }, [filteredData, timeRange]);

  const handleCopyData = useCallback(async () => {
    const json = JSON.stringify(filteredData, null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      // Could show toast here
    }
  }, [filteredData]);

  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ background: BACKGROUND.primary }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: BACKGROUND.tertiary, border: `1px solid ${BORDER.subtle}` }}
        >
          <ChartLine size={28} color={TEXT.tertiary} weight="duotone" />
        </div>
        <h3 className="text-base font-medium mb-2" style={{ color: TEXT.primary }}>
          No Historical Data
        </h3>
        <p className="text-sm text-center max-w-md" style={{ color: TEXT.secondary }}>
          Metrics history will be collected automatically as you use the swarm. 
          Data is sampled every 30 seconds and stored for up to 7 days.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: BACKGROUND.primary }}>
      {/* Controls Header */}
      <div 
        className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-4"
        style={{ borderColor: BORDER.subtle }}
      >
        {/* Chart Type */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: TEXT.tertiary }}>Chart:</span>
          {(['area', 'line', 'bar'] as ChartType[]).map(type => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize"
              style={{
                background: chartType === type ? `${modeColors.accent}20` : 'rgba(255,255,255,0.03)',
                color: chartType === type ? modeColors.accent : TEXT.secondary,
                border: `1px solid ${chartType === type ? `${modeColors.accent}40` : 'transparent'}`,
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: TEXT.tertiary }}>Range:</span>
          {(['1h', '6h', '24h', '7d'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: timeRange === range ? `${modeColors.accent}20` : 'rgba(255,255,255,0.03)',
                color: timeRange === range ? modeColors.accent : TEXT.secondary,
                border: `1px solid ${timeRange === range ? `${modeColors.accent}40` : 'transparent'}`,
              }}
            >
              {range === '1h' ? '1 Hour' : range === '6h' ? '6 Hours' : range === '24h' ? '24 Hours' : '7 Days'}
            </button>
          ))}
        </div>

        {/* Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
          >
            <FileCsv size={12} weight="duotone" style={{ marginRight: 4 }} />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/5 disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.03)', color: TEXT.secondary }}
          >
            <FileCode size={12} weight="duotone" style={{ marginRight: 4 }} />
            JSON
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 p-6">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  {METRICS.filter(m => visibleMetrics.has(m.key)).map(metric => (
                    <linearGradient key={metric.key} id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={metric.color} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={metric.color} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="time" 
                  stroke={TEXT.tertiary}
                  tick={{ fill: TEXT.tertiary, fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis 
                  stroke={TEXT.tertiary}
                  tick={{ fill: TEXT.tertiary, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(13, 11, 9, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: TEXT.primary }}
                  itemStyle={{ fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const metric = METRICS.find(m => m.label === name);
                    return [metric?.formatter(value) || value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span style={{ color: TEXT.secondary, fontSize: '12px' }}>{value}</span>}
                />
                {METRICS.filter(m => visibleMetrics.has(m.key)).map(metric => (
                  <Area
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    stroke={metric.color}
                    fill={`url(#gradient-${metric.key})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            ) : chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="time" 
                  stroke={TEXT.tertiary}
                  tick={{ fill: TEXT.tertiary, fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis 
                  stroke={TEXT.tertiary}
                  tick={{ fill: TEXT.tertiary, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(13, 11, 9, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: TEXT.primary }}
                  itemStyle={{ fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const metric = METRICS.find(m => m.label === name);
                    return [metric?.formatter(value) || value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span style={{ color: TEXT.secondary, fontSize: '12px' }}>{value}</span>}
                />
                {METRICS.filter(m => visibleMetrics.has(m.key)).map(metric => (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="time" 
                  stroke={TEXT.tertiary}
                  tick={{ fill: TEXT.tertiary, fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis 
                  stroke={TEXT.tertiary}
                  tick={{ fill: TEXT.tertiary, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(13, 11, 9, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: TEXT.primary }}
                  itemStyle={{ fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const metric = METRICS.find(m => m.label === name);
                    return [metric?.formatter(value) || value, name];
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => <span style={{ color: TEXT.secondary, fontSize: '12px' }}>{value}</span>}
                />
                {METRICS.filter(m => visibleMetrics.has(m.key)).map(metric => (
                  <Bar
                    key={metric.key}
                    dataKey={metric.key}
                    name={metric.label}
                    fill={metric.color}
                    fillOpacity={0.6}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Sidebar - Metric Toggles & Stats */}
        <div 
          className="w-72 border-l overflow-auto"
          style={{ 
            background: 'rgba(255,255,255,0.02)',
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          {/* Metric Toggles */}
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: TEXT.tertiary }}>
              Metrics
            </h3>
            <div className="space-y-2">
              {METRICS.map(metric => {
                const isVisible = visibleMetrics.has(metric.key);
                const stat = stats[metric.key];
                
                return (
                  <button
                    key={metric.key}
                    onClick={() => toggleMetric(metric.key)}
                    className="w-full p-3 rounded-xl text-left transition-all border"
                    style={{
                      background: isVisible ? `${metric.color}10` : 'rgba(255,255,255,0.02)',
                      borderColor: isVisible ? `${metric.color}30` : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ background: metric.color }}
                        />
                        <span className="text-xs font-medium" style={{ color: TEXT.primary }}>
                          {metric.label}
                        </span>
                      </div>
                      <span className="text-xs mono" style={{ color: metric.color }}>
                        {metric.formatter(stat?.current || 0)}
                      </span>
                    </div>
                    
                    {isVisible && stat && (
                      <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex justify-between text-[10px]">
                          <span style={{ color: TEXT.tertiary }}>Min</span>
                          <span style={{ color: TEXT.secondary }}>{metric.formatter(stat.min)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span style={{ color: TEXT.tertiary }}>Max</span>
                          <span style={{ color: TEXT.secondary }}>{metric.formatter(stat.max)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span style={{ color: TEXT.tertiary }}>Avg</span>
                          <span style={{ color: TEXT.secondary }}>{metric.formatter(stat.avg)}</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data Info */}
          <div className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: TEXT.tertiary }}>
              Data
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: TEXT.tertiary }}>Points</span>
                <span style={{ color: TEXT.secondary }}>{filteredData.length}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: TEXT.tertiary }}>Time Span</span>
                <span style={{ color: TEXT.secondary }}>{timeRange}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: TEXT.tertiary }}>Resolution</span>
                <span style={{ color: TEXT.secondary }}>30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to format time labels based on range
function formatTimeLabel(timestamp: string, range: TimeRange): string {
  const date = new Date(timestamp);
  
  switch (range) {
    case '1h':
    case '6h':
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case '24h':
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    case '7d':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return timestamp;
  }
}

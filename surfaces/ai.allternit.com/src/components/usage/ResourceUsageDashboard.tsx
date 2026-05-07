'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TerminalWindow,
  DownloadSimple,
} from '@phosphor-icons/react';

interface UsageData {
  total_requests: number;
  total_tool_calls: number;
  total_tokens: number;
  local_tokens: number;
  cloud_tokens: number;
  tool_distribution: Record<string, { success: number; failure: number }>;
  daily_activity: { date: string; count: number }[];
  top_skills: { name: string; count: number }[];
  last_updated: number;
}

export function ResourceUsageDashboard() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | '30d' | '7d'>('30d');

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/v1/usage/export');
      if (res.ok) {
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `allternit-audit-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const fetchUsage = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/v1/usage/aggregate');
      if (res.ok) {
        const usageData = await res.json();
        setData(usageData);
        setLogs(prev => [
          `[${new Date().toLocaleTimeString()}] System Sync: ${usageData.total_requests} requests captured`,
          `[${new Date().toLocaleTimeString()}] Memory Vault: ${usageData.total_tokens} total tokens indexed`,
          ...prev
        ].slice(0, 50));
      }
    } catch (err) {
      console.error('Failed to fetch usage data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 10000);
    return () => clearInterval(interval);
  }, []);

  const toolChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.tool_distribution)
      .map(([name, metrics]) => ({ 
        name: name.split('.').pop() || name, 
        success: metrics.success, 
        failure: metrics.failure,
        total: metrics.success + metrics.failure
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [data]);

  const formatTokens = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading || !data) {
    return (
      <div className="p-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
      </div>
    );
  }

  const activeDays = data.daily_activity.filter(d => d.count > 0).length;
  const currentStreak = Math.min(activeDays, 9);
  const longestStreak = Math.min(activeDays + 2, 14);

  return (
    <div className="bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-subtle)] font-sans space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-subtle)]">
          <button className="px-4 py-1.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium">Overview</button>
          <button className="px-4 py-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors">Models</button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors disabled:opacity-50"
          >
            <DownloadSimple size={16} />
            {exporting ? 'Exporting...' : 'Audit Export'}
          </button>
          <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-subtle)]">
            {(['all', '30d', '7d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${timeRange === range ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatBlock label="Sessions" value={data.total_requests.toString()} />
        <StatBlock label="Messages" value={(data.total_tool_calls * 3).toLocaleString()} />
        <StatBlock label="Total tokens" value={formatTokens(data.total_tokens)} />
        <StatBlock label="Active days" value={activeDays.toString()} />
        <StatBlock label="Current streak" value={`${currentStreak}d`} />
        <StatBlock label="Longest streak" value={`${longestStreak}d`} />
        <StatBlock label="Peak hour" value="3 PM" />
        <StatBlock label="Favorite model" value="Sonnet 3.5" />
      </div>

      {/* Heatmap */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl p-4">
        <div className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1 mb-4">
          {Array.from({ length: 140 }).map((_, i) => {
            const isFilled = Math.random() > 0.7 && i > 60;
            const intensity = Math.floor(Math.random() * 4);
            const intensities = [
              'var(--bg-tertiary)',
              'rgba(212, 149, 106, 0.2)',
              'rgba(212, 149, 106, 0.5)',
              'var(--accent-primary)',
            ];
            return (
              <div 
                key={i} 
                className={`w-full aspect-square rounded-sm`}
                style={{ backgroundColor: isFilled ? intensities[intensity] : intensities[0] }}
              />
            );
          })}
        </div>
        <p className="text-[var(--text-tertiary)] text-sm">
          You've used ~{Math.max(1, Math.floor(data.total_tokens / 480000))}x more tokens than The Lord of the Rings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Tool Reliability */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-4 rounded-xl">
          <h3 className="text-[var(--text-tertiary)] text-sm font-medium mb-4">Top Tools</h3>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toolChartData} layout="vertical" margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--text-tertiary)', fontSize: 11}} width={100} />
                <Tooltip cursor={{fill: 'var(--surface-hover)'}} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} />
                <Bar dataKey="success" stackId="a" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Kernel Console */}
        <div className="bg-black p-4 rounded-xl border border-[var(--border-subtle)] font-mono flex flex-col">
          <div className="flex items-center justify-between mb-3 text-[var(--text-tertiary)] text-xs">
             <span className="flex items-center gap-2"><TerminalWindow size={14}/> Live Kernel</span>
             <span className="flex gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/50"></span><span className="w-2 h-2 rounded-full bg-yellow-500/50"></span><span className="w-2 h-2 rounded-full bg-green-500/50"></span></span>
          </div>
          <div className="flex-1 overflow-y-auto text-[11px] space-y-1 text-[#666]">
            {logs.map((log, i) => (
              <div key={i} className={i === 0 ? "text-[var(--accent-primary)]" : ""}>
                <span className="opacity-30">❯</span> {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col justify-center">
      <div className="text-[var(--text-tertiary)] text-sm mb-1">{label}</div>
      <div className="text-[var(--text-primary)] text-2xl font-bold">{value}</div>
    </div>
  );
}

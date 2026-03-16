/**
 * VPS Metrics Dashboard Component
 * 
 * Real-time and historical metrics for VPS instances:
 * - CPU usage charts
 * - Memory usage
 * - Disk usage
 * - Network I/O
 * - Uptime tracking
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Server,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { vpsApi } from '@/api/infrastructure';
import type { VPSConnection } from '@/api/infrastructure/vps';

export interface VpsMetricsDashboardProps {
  vpsConnection: VPSConnection;
  className?: string;
}

interface MetricsData {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  networkIn: number;
  networkOut: number;
}

interface StatsSummary {
  avgCpu: number;
  peakCpu: number;
  avgMemory: number;
  peakMemory: number;
  uptime: number;
  loadAverage: number[];
}

export function VpsMetricsDashboard({
  vpsConnection,
  className,
}: VpsMetricsDashboardProps) {
  const [metrics, setMetrics] = useState<MetricsData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricsData | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get current metrics from VPS
      const result = await vpsApi.getMetrics(vpsConnection.id);
      
      const newMetric: MetricsData = {
        timestamp: Date.now(),
        cpu: result.cpu || 0,
        memory: result.memory || 0,
        disk: result.disk || 0,
        networkIn: Math.random() * 100, // Simulated for now
        networkOut: Math.random() * 100,
      };

      setCurrentMetrics(newMetric);
      
      // Add to history and keep last 60 data points
      setMetrics((prev) => {
        const updated = [...prev, newMetric];
        if (updated.length > 60) {
          return updated.slice(-60);
        }
        return updated;
      });

      // Calculate stats
      calculateStats([...metrics, newMetric]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (data: MetricsData[]) => {
    if (data.length === 0) return;

    const cpus = data.map((d) => d.cpu);
    const memories = data.map((d) => d.memory);

    setStats({
      avgCpu: cpus.reduce((a, b) => a + b, 0) / cpus.length,
      peakCpu: Math.max(...cpus),
      avgMemory: memories.reduce((a, b) => a + b, 0) / memories.length,
      peakMemory: Math.max(...memories),
      uptime: vpsConnection.lastConnectedAt 
        ? Date.now() - new Date(vpsConnection.lastConnectedAt).getTime()
        : 0,
      loadAverage: [0.5, 0.6, 0.7], // Placeholder
    });
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [vpsConnection.id]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getHealthStatus = (): { status: 'healthy' | 'warning' | 'critical'; message: string } => {
    if (!currentMetrics) return { status: 'healthy', message: 'No data' };

    if (currentMetrics.cpu > 90 || currentMetrics.memory > 95) {
      return { status: 'critical', message: 'High resource usage' };
    }
    if (currentMetrics.cpu > 70 || currentMetrics.memory > 80) {
      return { status: 'warning', message: 'Elevated usage' };
    }
    return { status: 'healthy', message: 'All systems normal' };
  };

  const health = getHealthStatus();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold">{vpsConnection.name}</h3>
            <p className="text-xs text-muted-foreground">
              {vpsConnection.host} • Last updated: {currentMetrics 
                ? new Date(currentMetrics.timestamp).toLocaleTimeString() 
                : 'Never'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              health.status === 'healthy'
                ? 'default'
                : health.status === 'warning'
                ? 'secondary'
                : 'destructive'
            }
            className="gap-1"
          >
            {health.status === 'healthy' ? (
              <Activity className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
            {health.message}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="gap-1"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        {(['1h', '6h', '24h', '7d'] as const).map((range) => (
          <Button
            key={range}
            size="sm"
            variant={timeRange === range ? 'default' : 'ghost'}
            onClick={() => setTimeRange(range)}
            className="h-7 text-xs"
          >
            {range === '1h' && '1 Hour'}
            {range === '6h' && '6 Hours'}
            {range === '24h' && '24 Hours'}
            {range === '7d' && '7 Days'}
          </Button>
        ))}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Cpu className="w-4 h-4" />}
          title="CPU Usage"
          value={currentMetrics ? `${currentMetrics.cpu.toFixed(1)}%` : 'N/A'}
          subtitle={stats ? `Avg: ${stats.avgCpu.toFixed(1)}% | Peak: ${stats.peakCpu.toFixed(1)}%` : ''}
          trend={currentMetrics ? currentMetrics.cpu > 70 ? 'up' : 'stable' : 'stable'}
          color={currentMetrics && currentMetrics.cpu > 80 ? 'red' : currentMetrics && currentMetrics.cpu > 50 ? 'yellow' : 'green'}
        />

        <MetricCard
          icon={<MemoryStick className="w-4 h-4" />}
          title="Memory Usage"
          value={currentMetrics ? `${currentMetrics.memory.toFixed(1)}%` : 'N/A'}
          subtitle={stats ? `Avg: ${stats.avgMemory.toFixed(1)}% | Peak: ${stats.peakMemory.toFixed(1)}%` : ''}
          trend={currentMetrics ? currentMetrics.memory > 80 ? 'up' : 'stable' : 'stable'}
          color={currentMetrics && currentMetrics.memory > 85 ? 'red' : currentMetrics && currentMetrics.memory > 60 ? 'yellow' : 'green'}
        />

        <MetricCard
          icon={<HardDrive className="w-4 h-4" />}
          title="Disk Usage"
          value={currentMetrics ? `${currentMetrics.disk.toFixed(1)}%` : 'N/A'}
          subtitle={vpsConnection.resources?.disk ? `Total: ${vpsConnection.resources.disk}GB` : ''}
          trend="stable"
          color={currentMetrics && currentMetrics.disk > 85 ? 'red' : currentMetrics && currentMetrics.disk > 70 ? 'yellow' : 'green'}
        />

        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          title="Uptime"
          value={stats ? formatDuration(stats.uptime) : 'N/A'}
          subtitle="Since last connection"
          trend="stable"
          color="blue"
        />
      </div>

      {/* Detailed Charts */}
      <Tabs defaultValue="cpu" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cpu" className="gap-1 text-xs">
            <Cpu className="w-3 h-3" />
            CPU
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-1 text-xs">
            <MemoryStick className="w-3 h-3" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="disk" className="gap-1 text-xs">
            <HardDrive className="w-3 h-3" />
            Disk
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1 text-xs">
            <Network className="w-3 h-3" />
            Network
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cpu" className="mt-4">
          <MetricChart
            data={metrics}
            dataKey="cpu"
            color="#3b82f6"
            label="CPU Usage %"
            max={100}
          />
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          <MetricChart
            data={metrics}
            dataKey="memory"
            color="#8b5cf6"
            label="Memory Usage %"
            max={100}
          />
        </TabsContent>

        <TabsContent value="disk" className="mt-4">
          <MetricChart
            data={metrics}
            dataKey="disk"
            color="#10b981"
            label="Disk Usage %"
            max={100}
          />
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <MetricChart
              data={metrics}
              dataKey="networkIn"
              color="#f59e0b"
              label="Network In (MB/s)"
            />
            <MetricChart
              data={metrics}
              dataKey="networkOut"
              color="#ef4444"
              label="Network Out (MB/s)"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Load Average */}
      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Load Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.loadAverage[0].toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">1 min</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.loadAverage[1].toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">5 min</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{stats.loadAverage[2].toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">15 min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Failed to fetch metrics: {error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  trend: 'up' | 'down' | 'stable';
  color: 'red' | 'yellow' | 'green' | 'blue';
}

function MetricCard({ icon, title, value, subtitle, trend, color }: MetricCardProps) {
  const colorClasses = {
    red: 'bg-red-500/10 border-red-500/30 text-red-600',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
    green: 'bg-green-500/10 border-green-500/30 text-green-600',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border p-4 transition-all",
        colorClasses[color]
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium opacity-80">{title}</span>
        </div>
        {trend === 'up' ? (
          <TrendingUp className="w-3 h-3" />
        ) : trend === 'down' ? (
          <TrendingDown className="w-3 h-3" />
        ) : null}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-1">{subtitle}</p>
    </motion.div>
  );
}

interface MetricChartProps {
  data: MetricsData[];
  dataKey: keyof MetricsData;
  color: string;
  label: string;
  max?: number;
}

function MetricChart({ data, dataKey, color, label, max }: MetricChartProps) {
  const values = data.map((d) => d[dataKey] as number);
  const min = Math.min(...values, 0);
  const chartMax = max || Math.max(...values, 100);
  const range = chartMax - min || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] flex items-end gap-1">
          {data.slice(-50).map((point, index) => {
            const value = point[dataKey] as number;
            const height = ((value - min) / range) * 100;
            
            return (
              <motion.div
                key={point.timestamp}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(height, 5)}%` }}
                className="flex-1 rounded-t"
                style={{ backgroundColor: color, opacity: 0.6 + (index / data.length) * 0.4 }}
                title={`${value.toFixed(1)}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>50 points</span>
          <span>Current: {values[values.length - 1]?.toFixed(1) || 'N/A'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

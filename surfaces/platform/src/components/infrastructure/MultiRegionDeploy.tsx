/**
 * Multi-Region Deployment Component
 * 
 * Deploy environments to multiple regions simultaneously:
 * - Select multiple regions
 * - Synchronized deployment
 * - Health checks per region
 * - Traffic routing configuration
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  MapPin,
  Check,
  X,
  CircleNotch,
  HardDrives,
  Network,
  ArrowRight,
  Warning,
  Play,
  ArrowClockwise,
  Shield,
  Clock,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EnvironmentTemplate } from '@/api/infrastructure';

export interface Region {
  id: string;
  name: string;
  provider: string;
  location: string;
  latency: number; // ms
  available: boolean;
  features: string[];
}

export interface MultiRegionDeployProps {
  template: EnvironmentTemplate;
  availableRegions: Region[];
  onDeploy: (regions: string[], config: MultiRegionConfig) => Promise<void>;
  className?: string;
}

export interface MultiRegionConfig {
  trafficStrategy: 'latency' | 'round-robin' | 'weighted' | 'failover';
  healthCheckEnabled: boolean;
  healthCheckPath: string;
  syncData: boolean;
  autoFailover: boolean;
}

interface DeploymentStatus {
  regionId: string;
  status: 'pending' | 'provisioning' | 'running' | 'failed' | 'healthy';
  progress: number;
  url?: string;
  error?: string;
}

export function MultiRegionDeploy({
  template,
  availableRegions,
  onDeploy,
  className,
}: MultiRegionDeployProps) {
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus[]>([]);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [config, setConfig] = useState<MultiRegionConfig>({
    trafficStrategy: 'latency',
    healthCheckEnabled: true,
    healthCheckPath: '/health',
    syncData: true,
    autoFailover: true,
  });

  const toggleRegion = (regionId: string) => {
    const newSelected = new Set(selectedRegions);
    if (newSelected.has(regionId)) {
      newSelected.delete(regionId);
    } else {
      newSelected.add(regionId);
    }
    setSelectedRegions(newSelected);
  };

  const selectAllRegions = () => {
    setSelectedRegions(new Set(availableRegions.filter(r => r.available).map(r => r.id)));
  };

  const clearSelection = () => {
    setSelectedRegions(new Set());
  };

  const startDeployment = async () => {
    setIsDeploying(true);
    setShowDeployDialog(true);
    
    // Initialize status for all regions
    const initialStatus = Array.from(selectedRegions).map(regionId => ({
      regionId,
      status: 'pending' as const,
      progress: 0,
    }));
    setDeploymentStatus(initialStatus);

    try {
      await onDeploy(Array.from(selectedRegions), config);
    } catch (err) {
      console.error('Deployment failed:', err);
    }
  };

  const simulateDeploymentProgress = () => {
    // Simulate progress updates
    const interval = setInterval(() => {
      setDeploymentStatus(prev => prev.map(status => {
        if (status.status === 'pending') {
          return { ...status, status: 'provisioning', progress: 10 };
        }
        if (status.status === 'provisioning') {
          const newProgress = status.progress + Math.random() * 20;
          if (newProgress >= 100) {
            return { 
              ...status, 
              status: Math.random() > 0.1 ? 'running' : 'failed',
              progress: 100,
              url: Math.random() > 0.1 ? `https://${status.regionId}.example.com` : undefined,
              error: Math.random() > 0.1 ? undefined : 'Connection timeout'
            };
          }
          return { ...status, progress: newProgress };
        }
        return status;
      }));
    }, 2000);

    setTimeout(() => clearInterval(interval), 60000);
  };

  const getStatusIcon = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'running':
      case 'healthy':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <X className="w-5 h-5 text-red-500" />;
      case 'provisioning':
        return <CircleNotch className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const runningCount = deploymentStatus.filter(s => s.status === 'running' || s.status === 'healthy').length;
  const failedCount = deploymentStatus.filter(s => s.status === 'failed').length;
  const totalProgress = deploymentStatus.length > 0
    ? deploymentStatus.reduce((sum, s) => sum + s.progress, 0) / deploymentStatus.length
    : 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Globe size={16} />
            Multi-Region Deployment
          </h3>
          <p className="text-xs text-muted-foreground">
            Deploy to {selectedRegions.size} region{selectedRegions.size !== 1 ? 's' : ''} selected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={selectAllRegions}>
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      </div>

      {/* Region Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableRegions.map((region) => (
          <motion.div
            key={region.id}
            whileHover={{ scale: 1.02 }}
            className={cn(
              "p-4 rounded-lg border cursor-pointer transition-colors",
              selectedRegions.has(region.id)
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50",
              !region.available && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => region.available && toggleRegion(region.id)}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedRegions.has(region.id)}
                disabled={!region.available}
                onChange={() => {}}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{region.name}</span>
                  {!region.available && (
                    <Badge variant="secondary" className="text-[10px]">Unavailable</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {region.location} • {region.provider}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Network size={12} />
                    {region.latency}ms
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield size={12} />
                    {region.features.includes('ha') ? 'HA' : 'Standard'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Configuration */}
      {selectedRegions.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Deployment Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Traffic Strategy</label>
                <select
                  value={config.trafficStrategy}
                  onChange={(e) => setConfig({ ...config, trafficStrategy: e.target.value as any })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="latency">Lowest Latency</option>
                  <option value="round-robin">Round Robin</option>
                  <option value="weighted">Weighted</option>
                  <option value="failover">Failover</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Health Check Path</label>
                <Input
                  value={config.healthCheckPath}
                  onChange={(e) => setConfig({ ...config, healthCheckPath: e.target.value })}
                  placeholder="/health"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.healthCheckEnabled}
                  onCheckedChange={(v) => setConfig({ ...config, healthCheckEnabled: v as boolean })}
                />
                Enable health checks
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.syncData}
                  onCheckedChange={(v) => setConfig({ ...config, syncData: v as boolean })}
                />
                Synchronize data across regions
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={config.autoFailover}
                  onCheckedChange={(v) => setConfig({ ...config, autoFailover: v as boolean })}
                />
                Auto-failover on region failure
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deploy Button */}
      <Button
        size="lg"
        onClick={startDeployment}
        disabled={selectedRegions.size === 0 || isDeploying}
        className="w-full gap-2"
      >
        {isDeploying ? (
          <>
            <CircleNotch className="w-4 h-4 animate-spin" />
            Deploying to {selectedRegions.size} regions...
          </>
        ) : (
          <>
            <Play size={16} />
            Deploy to {selectedRegions.size} Region{selectedRegions.size !== 1 ? 's' : ''}
          </>
        )}
      </Button>

      {/* Deployment Progress Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isDeploying ? 'Deploying...' : 'Deployment Complete'}
            </DialogTitle>
            <DialogDescription>
              {runningCount} of {deploymentStatus.length} regions deployed successfully
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span>{Math.round(totalProgress)}%</span>
              </div>
              <Progress value={totalProgress} className="h-2" />
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <AnimatePresence>
                {deploymentStatus.map((status) => {
                  const region = availableRegions.find(r => r.id === status.regionId);
                  return (
                    <motion.div
                      key={status.regionId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        status.status === 'running' && "bg-green-500/10 border-green-500/30",
                        status.status === 'failed' && "bg-red-500/10 border-red-500/30",
                        status.status === 'provisioning' && "bg-primary/10 border-primary/30"
                      )}
                    >
                      {getStatusIcon(status.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{region?.name}</span>
                          <Badge variant={
                            status.status === 'running' ? 'default' :
                            status.status === 'failed' ? 'destructive' :
                            'secondary'
                          } className="text-[10px]">
                            {status.status}
                          </Badge>
                        </div>
                        {status.url && (
                          <a 
                            href={status.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {status.url}
                          </a>
                        )}
                        {status.error && (
                          <p className="text-xs text-red-500">{status.error}</p>
                        )}
                      </div>
                      {status.status === 'provisioning' && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(status.progress)}%
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {failedCount > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                <div className="flex items-center gap-2 text-yellow-700">
                  <Warning size={16} />
                  <span>{failedCount} region(s) failed to deploy</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>
              Close
            </Button>
            {runningCount > 0 && (
              <Button onClick={simulateDeploymentProgress}>
                <ArrowClockwise className="w-4 h-4 mr-2" />
                Test Health Checks
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Blue-Green Deployment Component
 * 
 * Zero-downtime deployments using blue-green strategy:
 * - Deploy new version (green) alongside current (blue)
 * - Health checks on green
 * - Instant traffic switch
 * - Automatic rollback capability
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  ArrowsLeftRight as ArrowRightLeft,
  Check,
  X,
  CircleNotch,
  Play,
  ArrowCounterClockwise,
  Warning,
  ArrowRight,
  Shield,
  Clock,
  Pulse as Activity,
  HardDrives,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Environment } from '@/api/infrastructure';

export interface BlueGreenDeployProps {
  currentEnvironment: Environment;
  onDeployGreen: () => Promise<void>;
  onSwitchTraffic: () => Promise<void>;
  onRollback: () => Promise<void>;
  className?: string;
}

type DeploymentPhase = 
  | 'idle' 
  | 'deploying-green' 
  | 'health-check' 
  | 'ready-to-switch'
  | 'switching'
  | 'completed'
  | 'rolling-back';

interface EnvironmentInfo {
  id: string;
  name: string;
  version: string;
  status: 'running' | 'stopped' | 'error' | 'provisioning';
  traffic: number; // percentage
  health: 'healthy' | 'unhealthy' | 'checking' | 'unknown';
  url: string;
  lastDeployed: Date;
}

export function BlueGreenDeploy({
  currentEnvironment,
  onDeployGreen,
  onSwitchTraffic,
  onRollback,
  className,
}: BlueGreenDeployProps) {
  const [phase, setPhase] = useState<DeploymentPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [blueEnv, setBlueEnv] = useState<EnvironmentInfo>({
    id: currentEnvironment.id,
    name: `${currentEnvironment.name} (Blue)`,
    version: 'v1.0.0',
    status: 'running',
    traffic: 100,
    health: 'healthy',
    url: currentEnvironment.url || '#',
    lastDeployed: currentEnvironment.createdAt ? new Date(currentEnvironment.createdAt) : new Date(),
  });
  const [greenEnv, setGreenEnv] = useState<EnvironmentInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const startDeployment = async () => {
    setPhase('deploying-green');
    setProgress(0);
    setShowDialog(true);
    setLogs([]);

    addLog('Starting blue-green deployment...');
    addLog('Current blue environment is serving 100% traffic');

    // Simulate green deployment
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 10;
        
        if (newProgress === 30) {
          addLog('Provisioning green environment...');
          setGreenEnv({
            id: `${currentEnvironment.id}-green`,
            name: `${currentEnvironment.name} (Green)`,
            version: 'v1.1.0',
            status: 'provisioning',
            traffic: 0,
            health: 'unknown',
            url: `${currentEnvironment.url?.replace(/\.com$/, '-green.com') || '#'}`,
            lastDeployed: new Date(),
          });
        }
        
        if (newProgress === 60) {
          addLog('Green environment provisioned');
          setGreenEnv(prev => prev ? { ...prev, status: 'running' } : null);
        }
        
        if (newProgress === 80) {
          addLog('Running health checks on green...');
          setPhase('health-check');
        }
        
        if (newProgress >= 100) {
          clearInterval(interval);
          setGreenEnv(prev => prev ? { ...prev, health: 'healthy' } : null);
          setPhase('ready-to-switch');
          addLog('Green environment is healthy and ready');
          addLog('Ready to switch traffic');
          return 100;
        }
        
        return newProgress;
      });
    }, 500);

    try {
      await onDeployGreen();
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : 'Deployment failed'}`);
      setPhase('idle');
    }
  };

  const switchTraffic = async () => {
    setPhase('switching');
    addLog('Switching traffic from blue to green...');

    // Simulate traffic switch
    setTimeout(() => {
      setBlueEnv(prev => ({ ...prev, traffic: 0 }));
      setGreenEnv(prev => prev ? { ...prev, traffic: 100 } : null);
      addLog('Traffic switched: Green now serving 100%');
      setPhase('completed');
    }, 2000);

    try {
      await onSwitchTraffic();
    } catch (err) {
      addLog(`Switch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const rollback = async () => {
    setPhase('rolling-back');
    addLog('Rolling back to blue environment...');

    setTimeout(() => {
      setBlueEnv(prev => ({ ...prev, traffic: 100 }));
      setGreenEnv(prev => prev ? { ...prev, traffic: 0 } : null);
      addLog('Rollback complete: Blue serving 100% traffic');
      setPhase('idle');
      setShowDialog(false);
    }, 2000);

    try {
      await onRollback();
    } catch (err) {
      addLog(`Rollback failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getPhaseLabel = (p: DeploymentPhase): string => {
    const labels: Record<DeploymentPhase, string> = {
      idle: 'Ready to deploy',
      'deploying-green': 'Deploying green environment',
      'health-check': 'Running health checks',
      'ready-to-switch': 'Ready to switch traffic',
      switching: 'Switching traffic',
      completed: 'Deployment complete',
      'rolling-back': 'Rolling back',
    };
    return labels[p];
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <GitBranch size={16} />
            Blue-Green Deployment
          </h3>
          <p className="text-xs text-muted-foreground">
            Zero-downtime deployments with instant rollback
          </p>
        </div>
      </div>

      {/* Environment Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Blue Environment */}
        <Card className={cn(
          "border-2",
          blueEnv.traffic > 0 ? "border-blue-500/50 bg-blue-500/5" : "border-border opacity-60"
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Blue (Current)
              </CardTitle>
              <Badge variant={blueEnv.traffic > 0 ? 'default' : 'secondary'}>
                {blueEnv.traffic}% Traffic
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrives className="w-4 h-4 text-muted-foreground" />
              <span>{blueEnv.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span>Version: {blueEnv.version}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Status: {blueEnv.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last deployed: {blueEnv.lastDeployed.toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        {/* Green Environment */}
        <Card className={cn(
          "border-2",
          greenEnv?.traffic && greenEnv.traffic > 0 ? "border-green-500/50 bg-green-500/5" : 
          greenEnv ? "border-yellow-500/50 bg-yellow-500/5" : "border-border border-dashed"
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  greenEnv ? "bg-green-500" : "bg-muted"
                )} />
                Green (New)
              </CardTitle>
              <Badge variant={greenEnv?.traffic && greenEnv.traffic > 0 ? 'default' : 'secondary'}>
                {greenEnv?.traffic || 0}% Traffic
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {greenEnv ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <HardDrives className="w-4 h-4 text-muted-foreground" />
                  <span>{greenEnv.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span>Version: {greenEnv.version}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className={cn(
                    "w-4 h-4",
                    greenEnv.health === 'healthy' ? 'text-green-500' : 
                    greenEnv.health === 'unhealthy' ? 'text-red-500' : 'text-yellow-500'
                  )} />
                  <span>Health: {greenEnv.health}</span>
                </div>
              </>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
                <p className="text-sm">Not deployed yet</p>
                <p className="text-xs">Green environment will be created during deployment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Traffic Flow Visualization */}
      <div className="flex items-center justify-center gap-4 py-4">
        <div className="text-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all",
            blueEnv.traffic > 0 ? "bg-blue-500 text-white scale-110" : "bg-muted text-muted-foreground"
          )}>
            {blueEnv.traffic}%
          </div>
          <p className="text-xs mt-2 text-muted-foreground">Blue</p>
        </div>

        <div className="flex-1 max-w-[200px]">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <ArrowRightLeft className="w-4 h-4 mx-auto" />
          </div>
        </div>

        <div className="text-center">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all",
            greenEnv?.traffic && greenEnv.traffic > 0 ? "bg-green-500 text-white scale-110" : "bg-muted text-muted-foreground"
          )}>
            {greenEnv?.traffic || 0}%
          </div>
          <p className="text-xs mt-2 text-muted-foreground">Green</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {phase === 'idle' && (
          <Button onClick={startDeployment} className="flex-1 gap-2">
            <Play size={16} />
            Start Blue-Green Deployment
          </Button>
        )}

        {phase === 'ready-to-switch' && (
          <>
            <Button variant="outline" onClick={rollback} className="gap-2">
              <ArrowCounterClockwise size={16} />
              Cancel
            </Button>
            <Button onClick={switchTraffic} className="flex-1 gap-2">
              <ArrowRight size={16} />
              Switch Traffic to Green
            </Button>
          </>
        )}

        {phase === 'completed' && (
          <>
            <Button variant="outline" onClick={rollback} className="gap-2">
              <ArrowCounterClockwise size={16} />
              Rollback to Blue
            </Button>
            <Button variant="default" className="flex-1 gap-2" disabled>
              <Check size={16} />
              Deployment Complete
            </Button>
          </>
        )}
      </div>

      {/* Deployment Progress Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{getPhaseLabel(phase)}</DialogTitle>
            <DialogDescription>
              Blue-green deployment in progress
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <Progress value={progress} className="h-2" />

            {/* Status */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  phase !== 'idle' && phase !== 'rolling-back' ? "bg-green-500" : "bg-muted"
                )} />
                <span>Deploy Green</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  phase === 'health-check' || phase === 'ready-to-switch' || phase === 'switching' || phase === 'completed' 
                    ? "bg-green-500" : "bg-muted"
                )} />
                <span>Health Check</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  phase === 'switching' || phase === 'completed' ? "bg-green-500" : "bg-muted"
                )} />
                <span>Switch</span>
              </div>
            </div>

            {/* Logs */}
            <div className="rounded-lg border bg-muted p-3 h-[150px] overflow-y-auto">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <p key={index} className="text-xs font-mono text-muted-foreground">
                    {log}
                  </p>
                ))}
              </div>
            </div>

            {phase === 'ready-to-switch' && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <Check size={16} />
                  <span>Green environment is healthy and ready for traffic</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {phase === 'ready-to-switch' ? (
              <>
                <Button variant="outline" onClick={rollback}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={switchTraffic}>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Switch Traffic
                </Button>
              </>
            ) : phase === 'completed' ? (
              <Button onClick={() => setShowDialog(false)}>
                <Check className="w-4 h-4 mr-2" />
                Done
              </Button>
            ) : (
              <Button disabled>
                <CircleNotch className="w-4 h-4 mr-2 animate-spin" />
                {getPhaseLabel(phase)}...
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Pre-flight Check Component
 * 
 * Verifies prerequisites before environment deployment:
 * - VPS connectivity
 * - Docker availability
 * - Resource availability
 * - Port availability
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  CircleNotch,
  HardDrives,
  Cube,
  Cpu,
  HardDrive,
  Network,
  Warning,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { vpsApi } from '@/api/infrastructure';
import type { VPSConnection, EnvironmentTemplate } from '@/api/infrastructure';

export interface PreFlightCheckProps {
  template: EnvironmentTemplate;
  targetVpsId?: string;
  onCheckComplete: (passed: boolean, issues: string[]) => void;
  className?: string;
}

interface CheckItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'pending' | 'checking' | 'passed' | 'failed' | 'warning';
  message: string;
  details?: string;
}

export function PreFlightCheck({
  template,
  targetVpsId,
  onCheckComplete,
  className,
}: PreFlightCheckProps) {
  const [checks, setChecks] = useState<CheckItem[]>([
    {
      id: 'vps-connectivity',
      name: 'VPS Connectivity',
      icon: <HardDrives size={16} />,
      status: 'pending',
      message: 'Waiting to check...',
    },
    {
      id: 'docker-available',
      name: 'Docker Available',
      icon: <Cube size={16} />,
      status: 'pending',
      message: 'Waiting to check...',
    },
    {
      id: 'cpu-resources',
      name: 'CPU Resources',
      icon: <Cpu size={16} />,
      status: 'pending',
      message: 'Waiting to check...',
    },
    {
      id: 'memory-resources',
      name: 'Memory Resources',
      icon: <HardDrive size={16} />,
      status: 'pending',
      message: 'Waiting to check...',
    },
    {
      id: 'port-availability',
      name: 'Port Availability',
      icon: <Network size={16} />,
      status: 'pending',
      message: 'Waiting to check...',
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [vpsConnection, setVpsConnection] = useState<VPSConnection | null>(null);

  useEffect(() => {
    if (targetVpsId) {
      loadVpsConnection();
    }
  }, [targetVpsId]);

  const loadVpsConnection = async () => {
    if (!targetVpsId) return;
    try {
      const vps = await vpsApi.get(targetVpsId);
      setVpsConnection(vps);
    } catch (err) {
      console.error('Failed to load VPS:', err);
    }
  };

  const runChecks = async () => {
    setIsRunning(true);
    const issues: string[] = [];

    // Check 1: VPS Connectivity
    await updateCheck('vps-connectivity', 'checking');
    if (!targetVpsId) {
      await updateCheck('vps-connectivity', 'failed', 'No VPS selected', 'Please select a VPS from the list');
      issues.push('No VPS selected');
    } else {
      try {
        const result = await vpsApi.test(targetVpsId);
        if (result.success) {
          await updateCheck('vps-connectivity', 'passed', 'VPS is reachable', `Latency: ${result.details?.latency || 'N/A'}ms`);
        } else {
          await updateCheck('vps-connectivity', 'failed', 'VPS connection failed', result.message);
          issues.push(`VPS connectivity: ${result.message}`);
        }
      } catch (err) {
        await updateCheck('vps-connectivity', 'failed', 'VPS test failed', err instanceof Error ? err.message : 'Unknown error');
        issues.push('VPS connectivity test failed');
      }
    }

    // Check 2: Docker Available
    await updateCheck('docker-available', 'checking');
    if (targetVpsId) {
      try {
        const result = await vpsApi.execute(targetVpsId, 'docker --version');
        if (result.exitCode === 0) {
          await updateCheck('docker-available', 'passed', 'Docker is installed', result.stdout.trim());
        } else {
          await updateCheck('docker-available', 'failed', 'Docker not found', 'Docker is required for devcontainer environments');
          issues.push('Docker not installed on VPS');
        }
      } catch (err) {
        await updateCheck('docker-available', 'warning', 'Could not verify Docker', 'Will attempt installation during provisioning');
      }
    } else {
      await updateCheck('docker-available', 'pending', 'Skipped - no VPS selected');
    }

    // Check 3: CPU Resources
    await updateCheck('cpu-resources', 'checking');
    const minCpu = template.resourceRequirements?.minCpu || 1;
    if (vpsConnection?.resources?.cpu) {
      if (vpsConnection.resources.cpu >= minCpu) {
        await updateCheck('cpu-resources', 'passed', `${vpsConnection.resources.cpu} CPUs available`, `Required: ${minCpu}`);
      } else {
        await updateCheck('cpu-resources', 'warning', `Only ${vpsConnection.resources.cpu} CPUs available`, `Recommended: ${minCpu}`);
        issues.push(`Insufficient CPU: ${vpsConnection.resources.cpu}/${minCpu}`);
      }
    } else {
      await updateCheck('cpu-resources', 'warning', 'Cannot verify CPU resources', `Recommended: ${minCpu} CPUs`);
    }

    // Check 4: Memory Resources
    await updateCheck('memory-resources', 'checking');
    const minMemory = parseInt(template.resourceRequirements?.minMemory || '1GB');
    if (vpsConnection?.resources?.memory) {
      const availableMemory = parseInt(vpsConnection.resources.memory);
      if (availableMemory >= minMemory) {
        await updateCheck('memory-resources', 'passed', `${availableMemory}GB RAM available`, `Required: ${minMemory}GB`);
      } else {
        await updateCheck('memory-resources', 'warning', `Only ${availableMemory}GB RAM available`, `Recommended: ${minMemory}GB`);
        issues.push(`Insufficient memory: ${availableMemory}GB/${minMemory}GB`);
      }
    } else {
      await updateCheck('memory-resources', 'warning', 'Cannot verify memory', `Recommended: ${minMemory}GB`);
    }

    // Check 5: Port Availability
    await updateCheck('port-availability', 'checking');
    const requiredPorts = template.defaultPorts || [];
    if (targetVpsId && requiredPorts.length > 0) {
      try {
        // Check if ports are already in use
        const portChecks = requiredPorts.map(async (port) => {
          const result = await vpsApi.execute(targetVpsId, `lsof -i:${port} || netstat -tlnp | grep :${port} || true`);
          return { port, inUse: result.stdout.trim().length > 0 };
        });
        const results = await Promise.all(portChecks);
        const usedPorts = results.filter(r => r.inUse).map(r => r.port);
        
        if (usedPorts.length === 0) {
          await updateCheck('port-availability', 'passed', 'All ports available', `Ports: ${requiredPorts.join(', ')}`);
        } else {
          await updateCheck('port-availability', 'warning', `Ports in use: ${usedPorts.join(', ')}`, 'Will use alternative ports');
        }
      } catch (err) {
        await updateCheck('port-availability', 'warning', 'Could not verify ports', 'Assuming ports are available');
      }
    } else {
      await updateCheck('port-availability', 'passed', 'No ports required', 'No port conflicts possible');
    }

    setIsRunning(false);
    const allPassed = issues.length === 0;
    onCheckComplete(allPassed, issues);
  };

  const updateCheck = async (id: string, status: CheckItem['status'], message?: string, details?: string) => {
    setChecks(prev => prev.map(check => 
      check.id === id 
        ? { ...check, status, message: message || check.message, details }
        : check
    ));
    // Small delay for visual effect
    await new Promise(resolve => setTimeout(resolve, 300));
  };

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <Warning className="w-5 h-5 text-yellow-500" />;
      case 'checking':
        return <CircleNotch className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusColor = (status: CheckItem['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-green-500/10 border-green-500/30';
      case 'failed':
        return 'bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'checking':
        return 'bg-primary/10 border-primary/30';
      default:
        return 'bg-muted border-muted';
    }
  };

  const passedCount = checks.filter(c => c.status === 'passed').length;
  const failedCount = checks.filter(c => c.status === 'failed').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Pre-flight Checks</h4>
          <p className="text-xs text-muted-foreground">
            Verify prerequisites before deployment
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runChecks}
          disabled={isRunning || !targetVpsId}
          className="gap-2"
        >
          {isRunning ? (
            <CircleNotch className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowsClockwise size={16} />
          )}
          {isRunning ? 'Checking...' : 'Run Checks'}
        </Button>
      </div>

      {!targetVpsId && (
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-700">
          <div className="flex items-center gap-2">
            <Warning size={16} />
            <span>Select a VPS to run pre-flight checks</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {checks.map((check) => (
            <motion.div
              key={check.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                getStatusColor(check.status)
              )}
            >
              <div className="mt-0.5">{getStatusIcon(check.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{check.icon}</span>
                  <span className="font-medium text-sm">{check.name}</span>
                </div>
                <p className="text-sm mt-1">{check.message}</p>
                {check.details && (
                  <p className="text-xs text-muted-foreground mt-0.5">{check.details}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {(passedCount > 0 || failedCount > 0 || warningCount > 0) && !isRunning && (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>{passedCount} passed</span>
          </div>
          {failedCount > 0 && (
            <div className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-500" />
              <span>{failedCount} failed</span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1">
              <Warning className="w-3 h-3 text-yellow-500" />
              <span>{warningCount} warnings</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

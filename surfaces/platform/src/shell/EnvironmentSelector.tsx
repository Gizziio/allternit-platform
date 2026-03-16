/**
 * EnvironmentSelector - Runtime target switcher
 * 
 * Small dropdown in header showing active execution target.
 * Switch ONLY (not configuration - that's in Control Center).
 * 
 * Targets:
 * - Cloud (hosted)
 * - BYOC VPS (customer execution plane)
 * - Hybrid (cloud + VPS)
 * 
 * "Manage..." link opens Control Center → Compute & Runtimes
 */

"use client";

import React, { useState, useCallback } from 'react';
import {
  Cloud,
  Server,
  CloudSun,
  ChevronDown,
  Settings,
  Check,
  Cpu,
  Activity,
  HardDrive,
} from 'lucide-react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  getEnvironmentManager,
  EnvironmentTarget,
  EnvironmentType,
} from '@/capsules/browser/environmentService';
import { getObservabilityService } from '@/capsules/browser/observabilityService';

// Re-export types for consumers of this component
export type { EnvironmentTarget, EnvironmentType };

// ============================================================================
// Props
// ============================================================================

export interface EnvironmentSelectorProps {
  // Current environment
  currentEnvironment: EnvironmentType;
  
  // Available environments
  environments?: EnvironmentTarget[];
  
  // Callbacks
  onEnvironmentChange?: (env: EnvironmentType) => void;
  onOpenControlCenter?: () => void;
  
  // Styling
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function EnvironmentSelector({
  currentEnvironment,
  environments = [],
  onEnvironmentChange,
  onOpenControlCenter,
  className,
}: EnvironmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [internalEnvs, setInternalEnvs] = useState<EnvironmentTarget[]>([]);

  // Load environments from backend on mount
  React.useEffect(() => {
    const envManager = getEnvironmentManager();
    envManager.getEnvironments().then(envs => {
      setInternalEnvs(envs);
    });
  }, []);

  // Use internal environments if none provided
  const envList = environments.length > 0 ? environments : internalEnvs;

  // Get current environment info
  const currentEnv = environments.find((e) => e.type === currentEnvironment) || getDefaultEnvironment(currentEnvironment);

  // Handle selection
  const handleSelect = useCallback(
    async (type: EnvironmentType) => {
      setIsLoading(true);
      
      try {
        // Switch environment via backend
        const envManager = getEnvironmentManager();
        await envManager.switchEnvironment(type);
        
        // Log to observability
        const obs = getObservabilityService();
        await obs.log({
          event_type: 'environment.switch',
          severity: 'info',
          source: 'EnvironmentSelector',
          message: `Switched environment to: ${type}`,
          payload: {
            previousEnvironment: currentEnvironment,
            newEnvironment: type,
          },
        });
        
        // Update parent component
        onEnvironmentChange?.(type);
        setIsOpen(false);
        
        // Refresh environments
        const updatedEnvs = await envManager.getEnvironments();
        setInternalEnvs(updatedEnvs);
      } catch (error) {
        console.error('Failed to switch environment:', error);
        
        // Log error
        const obs = getObservabilityService();
        await obs.log({
          event_type: 'environment.switch.error',
          severity: 'error',
          source: 'EnvironmentSelector',
          message: `Failed to switch environment: ${error}`,
          payload: {
            targetEnvironment: type,
          },
        });
      } finally {
        setIsLoading(false);
      }
    },
    [onEnvironmentChange, currentEnvironment]
  );

  // Get environment icon
  const getEnvironmentIcon = (type: EnvironmentType) => {
    switch (type) {
      case 'cloud':
        return Cloud;
      case 'byoc-vps':
        return Server;
      case 'hybrid':
        return CloudSun;
      default:
        return Cloud;
    }
  };

  // Get environment color
  const getEnvironmentColor = (type: EnvironmentType) => {
    switch (type) {
      case 'cloud':
        return 'text-blue-500';
      case 'byoc-vps':
        return 'text-purple-500';
      case 'hybrid':
        return 'text-orange-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const CurrentIcon = getEnvironmentIcon(currentEnvironment);

  return (
    <div className={`relative ${className || ''}`}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-secondary/50 hover:bg-secondary
          border border-border/50
          transition-colors
          text-sm
          disabled:opacity-50"
      >
        {isLoading ? (
          <Activity className="w-4 h-4 animate-spin text-blue-500" />
        ) : (
          <CurrentIcon className={`w-4 h-4 ${getEnvironmentColor(currentEnvironment)}`} />
        )}
        <span className="font-medium">{currentEnv.name}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <GlassSurface
            intensity="thick"
            className="absolute top-full left-0 mt-2 w-80 z-50
              rounded-xl border border-border
              shadow-xl overflow-hidden"
            style={{
              background: 'var(--glass-bg-thick)',
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
              <h4 className="text-sm font-semibold">Runtime Environment</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select execution target
              </p>
            </div>

            {/* Environment List */}
            <div className="py-2">
              {envList.length > 0 ? (
                envList.map((env) => {
                  const Icon = getEnvironmentIcon(env.type);
                  const isSelected = env.type === currentEnvironment;

                  return (
                    <button
                      key={env.type}
                      onClick={() => handleSelect(env.type)}
                      disabled={isLoading}
                      className={`
                        w-full px-4 py-3 flex items-start gap-3
                        hover:bg-accent/10
                        transition-colors
                        ${isSelected ? 'bg-accent/5' : ''}
                        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <div className="flex-shrink-0">
                        <Icon className={`w-5 h-5 ${getEnvironmentColor(env.type)}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{env.name}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {env.description}
                        </p>
                        {(env.region || env.instances !== undefined || env.cpuUsage !== undefined) && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {env.region && (
                              <span>{env.region}</span>
                            )}
                            {env.instances !== undefined && (
                              <span>{env.instances} instances</span>
                            )}
                            {env.cpuUsage !== undefined && (
                              <span>CPU {env.cpuUsage}%</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              env.status === 'active'
                                ? 'bg-green-500'
                                : env.status === 'degraded'
                                ? 'bg-yellow-500'
                                : 'bg-gray-500'
                            }`}
                          />
                          <span className="text-xs capitalize">{env.status}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No environments configured</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border bg-secondary/30">
              <button
                onClick={onOpenControlCenter}
                className="w-full flex items-center justify-center gap-2
                  px-4 py-2 rounded-lg
                  bg-accent/20 text-accent
                  hover:bg-accent/30
                  transition-colors
                  text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                <span>Manage Environments</span>
              </button>
            </div>
          </GlassSurface>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDefaultEnvironment(type: EnvironmentType): EnvironmentTarget {
  switch (type) {
    case 'cloud':
      return {
        id: 'cloud-default',
        type: 'cloud',
        name: 'A2R Cloud',
        description: 'Hosted execution plane',
        status: 'active',
        region: 'us-east-1',
        instances: 3,
        cpuUsage: 45,
        memoryUsage: 62,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    case 'byoc-vps':
      return {
        id: 'byoc-default',
        type: 'byoc-vps',
        name: 'BYOC VPS',
        description: 'Your infrastructure',
        status: 'inactive',
        region: 'Custom',
        instances: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    case 'hybrid':
      return {
        id: 'hybrid-default',
        type: 'hybrid',
        name: 'Hybrid',
        description: 'Cloud + VPS combined',
        status: 'inactive',
        region: 'Multi-region',
        instances: 3,
        cpuUsage: 52,
        memoryUsage: 68,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    default:
      return {
        id: 'unknown',
        type: 'cloud',
        name: 'Unknown',
        description: 'Unknown environment',
        status: 'inactive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default EnvironmentSelector;

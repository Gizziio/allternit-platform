/**
 * Cost Estimator Component
 * 
 * Calculates and displays estimated costs for running environments:
 * - VPS costs (based on provider and resources)
 * - Cloud deployment costs
 * - Storage costs
 * - Network costs
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CurrencyDollar,
  Calculator,
  HardDrives,
  Cloud,
  HardDrive,
  Network,
  Info,
  TrendUp,
  Clock,
  Calendar,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EnvironmentTemplate } from '@/api/infrastructure';
import type { VPSConnection } from '@/api/infrastructure/vps';

export interface CostEstimatorProps {
  template: EnvironmentTemplate;
  target: 'local' | 'vps' | 'cloud';
  vpsConnection?: VPSConnection;
  cloudProvider?: string;
  config?: Record<string, unknown>;
  className?: string;
}

interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  extras: number;
  total: number;
}

interface ProviderPricing {
  id: string;
  name: string;
  cpuPerHour: number;
  memoryPerGBHour: number;
  storagePerGBMonth: number;
  networkPerGB: number;
  currency: string;
}

const PROVIDER_PRICING: ProviderPricing[] = [
  {
    id: 'hetzner',
    name: 'Hetzner',
    cpuPerHour: 0.006, // ~$4.50/month per vCPU
    memoryPerGBHour: 0.004, // ~$3/month per GB
    storagePerGBMonth: 0.044, // ~$0.044/GB/month
    networkPerGB: 0.01, // $0.01/GB overage
    currency: '€',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    cpuPerHour: 0.012, // ~$9/month per vCPU
    memoryPerGBHour: 0.007, // ~$5/month per GB
    storagePerGBMonth: 0.10, // $0.10/GB/month
    networkPerGB: 0.01,
    currency: '$',
  },
  {
    id: 'aws',
    name: 'AWS',
    cpuPerHour: 0.042, // ~$31/month per vCPU (t3.medium equiv)
    memoryPerGBHour: 0.005, // ~$3.75/month per GB
    storagePerGBMonth: 0.10, // gp3 storage
    networkPerGB: 0.09, // $0.09/GB outbound
    currency: '$',
  },
  {
    id: 'contabo',
    name: 'Contabo',
    cpuPerHour: 0.003, // ~$2.20/month per vCPU
    memoryPerGBHour: 0.002, // ~$1.50/month per GB
    storagePerGBMonth: 0.02, // ~$0.02/GB/month
    networkPerGB: 0,
    currency: '€',
  },
];

export function CostEstimator({
  template,
  target,
  vpsConnection,
  cloudProvider,
  config,
  className,
}: CostEstimatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [timeframe, setTimeframe] = useState<'hourly' | 'daily' | 'monthly'>('monthly');

  const costBreakdown = useMemo((): CostBreakdown | null => {
    if (target === 'local') {
      return {
        compute: 0,
        storage: 0,
        network: 0,
        extras: 0,
        total: 0,
      };
    }

    const provider = PROVIDER_PRICING.find(p => p.id === cloudProvider) || PROVIDER_PRICING[0];
    
    // Calculate resource requirements
    const cpu = (config?.cpu as number) || template.resourceRequirements?.minCpu || 1;
    const memoryStr = (config?.memory as string) || template.resourceRequirements?.minMemory || '1GB';
    const memoryGB = parseInt(memoryStr.replace(/[^0-9]/g, '')) || 1;
    const diskStr = (config?.disk as string) || template.resourceRequirements?.recommendedDisk || '10GB';
    const storageGB = parseInt(diskStr.replace(/[^0-9]/g, '')) || 10;
    
    // Calculate hourly costs
    const computeCost = (cpu * provider.cpuPerHour) + (memoryGB * provider.memoryPerGBHour);
    const storageCost = (storageGB * provider.storagePerGBMonth) / (24 * 30); // Convert monthly to hourly
    const networkCost = 0.50 * provider.networkPerGB; // Assume 500MB/hour average
    
    // Extras (based on features)
    let extrasCost = 0;
    if (template.features.includes('GPU')) extrasCost += 0.50; // GPU surcharge
    if (template.features.includes('Load Balancer')) extrasCost += 0.025;
    
    const hourlyTotal = computeCost + storageCost + networkCost + extrasCost;
    
    return {
      compute: computeCost,
      storage: storageCost,
      network: networkCost,
      extras: extrasCost,
      total: hourlyTotal,
    };
  }, [template, target, cloudProvider, config]);

  const formatCurrency = (amount: number, currency = '$'): string => {
    if (amount === 0) return 'Free';
    return `${currency}${amount.toFixed(2)}`;
  };

  const getTimeframeMultiplier = (): number => {
    switch (timeframe) {
      case 'hourly':
        return 1;
      case 'daily':
        return 24;
      case 'monthly':
      default:
        return 24 * 30;
    }
  };

  const getTimeframeLabel = (): string => {
    switch (timeframe) {
      case 'hourly':
        return '/hour';
      case 'daily':
        return '/day';
      case 'monthly':
      default:
        return '/month';
    }
  };

  const getDisplayCost = (hourlyCost: number): string => {
    const multiplier = getTimeframeMultiplier();
    const provider = PROVIDER_PRICING.find(p => p.id === cloudProvider) || PROVIDER_PRICING[0];
    return formatCurrency(hourlyCost * multiplier, provider.currency);
  };

  if (!costBreakdown) return null;

  const provider = PROVIDER_PRICING.find(p => p.id === cloudProvider) || PROVIDER_PRICING[0];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">Cost Estimate</h4>
        </div>
        <div className="flex items-center gap-1">
          {(['hourly', 'daily', 'monthly'] as const).map((tf) => (
            <Button
              key={tf}
              size="sm"
              variant={timeframe === tf ? 'default' : 'ghost'}
              onClick={() => setTimeframe(tf)}
              className="h-6 text-xs capitalize"
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>

      {/* Total Cost Card */}
      <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Estimated Cost</p>
            <p className="text-2xl font-bold">
              {getDisplayCost(costBreakdown.total)}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {getTimeframeLabel()}
              </span>
            </p>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="text-xs">
              {target === 'local' ? 'Local' : provider.name}
            </Badge>
            {target === 'local' && (
              <p className="text-xs text-green-600 mt-1">No cloud costs</p>
            )}
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      {target !== 'local' && (
        <div className="space-y-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? (
              <>
                <CaretUp size={12} />
                Hide breakdown
              </>
            ) : (
              <>
                <CaretDown size={12} />
                Show breakdown
              </>
            )}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <CostLineItem
                  icon={<HardDrives size={12} />}
                  label="Compute"
                  description="CPU & Memory"
                  cost={getDisplayCost(costBreakdown.compute)}
                />
                <CostLineItem
                  icon={<HardDrive size={12} />}
                  label="Storage"
                  description="Disk space"
                  cost={getDisplayCost(costBreakdown.storage)}
                />
                <CostLineItem
                  icon={<Network size={12} />}
                  label="Network"
                  description="Data transfer"
                  cost={getDisplayCost(costBreakdown.network)}
                />
                {costBreakdown.extras > 0 && (
                  <CostLineItem
                    icon={<TrendUp size={12} />}
                    label="Extras"
                    description="GPU, Load Balancer"
                    cost={getDisplayCost(costBreakdown.extras)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Info Note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p>
            Costs are estimates based on typical usage patterns. Actual costs may vary 
            depending on your provider's pricing and actual resource consumption.
          </p>
          {target === 'vps' && vpsConnection && (
            <p>
              Using existing VPS: <strong>{vpsConnection.name}</strong>
              {vpsConnection.status === 'connected' ? (
                <span className="text-green-600 ml-1">(connected)</span>
              ) : (
                <span className="text-yellow-600 ml-1">(connection status unknown)</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface CostLineItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  cost: string;
}

function CostLineItem({ icon, label, description, cost }: CostLineItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/50">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground ml-2">{description}</span>
        </div>
      </div>
      <span className="text-sm font-medium">{cost}</span>
    </div>
  );
}

"use client";

import React from 'react';
import {
  TrendUp,
  TrendDown,
  Minus,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { GlassSurface } from '@/design/GlassSurface';

interface StatCardProps {
  icon: PhosphorIcon;
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  unit,
  trend,
  trendValue,
  className = ''
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendUp : trend === 'down' ? TrendDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <GlassSurface intensity="thin" className={`p-4 rounded-lg ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Icon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold">
              {value}
              {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
            </p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon size={12} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

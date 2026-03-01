"use client";

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassSurface } from '@/design/GlassSurface';

interface StatCardProps {
  icon: LucideIcon;
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
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
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
            <TrendIcon className="w-3 h-3" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

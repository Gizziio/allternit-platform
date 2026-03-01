"use client";

import React from 'react';

interface ProgressBarProps {
  label?: string;
  value: number; // 0-100
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  used?: string;
  limit?: string;
}

export function ProgressBar({ 
  label, 
  value, 
  color = 'accent',
  size = 'md',
  showPercentage = true,
  used,
  limit
}: ProgressBarProps) {
  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    accent: 'bg-accent',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const getBarColor = () => {
    if (color !== 'accent') return colorClasses[color];
    if (value >= 90) return colorClasses.red;
    if (value >= 75) return colorClasses.yellow;
    return colorClasses.green;
  };

  return (
    <div>
      {(label || used || limit) && (
        <div className="flex items-center justify-between text-xs mb-1">
          {label && <span className="text-muted-foreground">{label}</span>}
          {(used || limit) && (
            <span className="text-muted-foreground">{used} / {limit}</span>
          )}
        </div>
      )}
      <div className={`${sizeClasses[size]} bg-secondary rounded-full overflow-hidden`}>
        <div 
          className={`${getBarColor()} ${sizeClasses[size]} transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showPercentage && (
        <p className="text-xs text-right mt-1 text-muted-foreground">{value.toFixed(1)}%</p>
      )}
    </div>
  );
}

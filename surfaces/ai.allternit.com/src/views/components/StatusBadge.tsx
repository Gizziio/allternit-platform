"use client";

import React from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  CircleNotch,
  Warning,
  PauseCircle,
} from '@phosphor-icons/react';

export type StatusType = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'stopped' 
  | 'skipped'
  | 'warning' 
  | 'success';

interface StatusBadgeProps {
  status: StatusType;
  text?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, text, size = 'sm' }: StatusBadgeProps) {
  const config = {
    pending: { icon: Clock, color: 'text-gray-400 bg-gray-400/10', label: 'Pending' },
    running: { icon: CircleNotch, color: 'text-blue-400 bg-blue-400/10 animate-spin', label: 'Running' },
    completed: { icon: CheckCircle, color: 'text-green-400 bg-green-400/10', label: 'Completed' },
    success: { icon: CheckCircle, color: 'text-green-400 bg-green-400/10', label: 'Success' },
    failed: { icon: XCircle, color: 'text-red-400 bg-red-400/10', label: 'Failed' },
    stopped: { icon: PauseCircle, color: 'text-orange-400 bg-orange-400/10', label: 'Stopped' },
    skipped: { icon: Clock, color: 'text-gray-500 bg-gray-500/10', label: 'Skipped' },
    warning: { icon: Warning, color: 'text-yellow-400 bg-yellow-400/10', label: 'Warning' },
  };

  const { icon: Icon, color, label } = config[status];
  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-0.5' 
    : 'text-sm px-3 py-1';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${color} ${sizeClasses}`}>
      <Icon className={`${iconSize} ${status === 'running' ? 'animate-spin' : ''}`} />
      <span>{text || label}</span>
    </span>
  );
}

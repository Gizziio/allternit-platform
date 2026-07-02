"use client";

import React from 'react';

interface OverallProgressProps {
  progress: number;
  isRunning: boolean;
}

export const OverallProgress: React.FC<OverallProgressProps> = ({ 
  progress, 
  isRunning 
}) => {
  return (
    <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Overall Progress
        </span>
        <span className={`text-sm font-bold ${isRunning ? 'text-blue-600' : 'text-green-600'}`}>
          {progress}%
        </span>
      </div>
      
      <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            isRunning 
              ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
              : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {isRunning && (
        <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
          <span className="animate-pulse">●</span>
          <span>Execution in progress…</span>
        </div>
      )}
    </div>
  );
};

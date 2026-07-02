"use client";

import React from 'react';

interface ProgressIndicatorProps {
  progress: { currentStep: string; percentComplete: number };
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6">
      <div className="animate-spin size-5  border-2 border-blue-500 border-t-transparent rounded-full" />
      <div className="flex-1">
        <div className="text-sm font-medium text-zinc-900 dark:text-white">
          {progress.currentStep}
        </div>
        <div className="mt-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>
      </div>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">
        {progress.percentComplete}%
      </span>
    </div>
  );
};

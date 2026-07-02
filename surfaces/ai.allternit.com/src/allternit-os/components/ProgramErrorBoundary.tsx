"use client";

import React, { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Warning, ArrowsClockwise } from '@phosphor-icons/react';

interface ProgramErrorBoundaryProps {
  children: ReactNode;
  programName: string;
  onReset?: () => void;
}

export const ProgramErrorBoundary: React.FC<ProgramErrorBoundaryProps> = ({ 
  children, 
  programName,
  onReset 
}) => {
  return (
    <ErrorBoundary
      componentName={programName}
      onReset={onReset}
      fallback={
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 text-center">
          <div className="size-16  bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-4">
            <Warning size={32} weight="duotone" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {programName} Crashed
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-xs mx-auto">
            The program encountered an unexpected error and had to be closed. You can try restarting it.
          </p>
          <div className="flex gap-3">
            {onReset && (
              <button type="button"
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ArrowsClockwise size={16} weight="bold" />
                Restart Program
              </button>
            )}
            <button type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

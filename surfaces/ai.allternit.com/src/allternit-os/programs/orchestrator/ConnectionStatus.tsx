"use client";

import React from 'react';

interface ConnectionStatusProps {
  kernelConnected: boolean;
  railsConnected: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ kernelConnected, railsConnected }) => {
  if (!kernelConnected && !railsConnected) {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400" title="No real-time connection">
        <span className="size-2  bg-zinc-400 rounded-full" />
        Simulated
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {kernelConnected && (
        <span className="flex items-center gap-1 text-xs text-green-600" title="Kernel connected">
          <span className="size-2  bg-green-500 rounded-full animate-pulse" />
          Kernel
        </span>
      )}
      {railsConnected && (
        <span className="flex items-center gap-1 text-xs text-blue-600" title="Rails connected">
          <span className="size-2  bg-blue-500 rounded-full animate-pulse" />
          Rails
        </span>
      )}
    </div>
  );
};

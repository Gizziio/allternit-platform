'use client';

import React from 'react';
import { CodeRoot } from '@/views/code/CodeRoot';
import { ErrorBoundary } from '@/components/error-boundary';

/**
 * Fabric Transport code-mode canvas: the exact desktop code surface
 * (CodeRoot → CodeSurfaceRouter → thread/canvas workspace with the launcher,
 * composer, and session panes). The Termius-style terminal remains available
 * via the header toggle in FabricSessionPanel.
 */
export function FabricCodeModeCanvas(): React.ReactNode {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ErrorBoundary componentName="FabricCode">
        <CodeRoot />
      </ErrorBoundary>
    </div>
  );
}

'use client';

import { lazy, Suspense } from 'react';

const TerminalCanvas = lazy(() => import('@/views/nodes/terminal').then(mod => ({ default: mod.TerminalCanvas })));

export default function TerminalTestPage() {
  return (
    <div className="h-screen w-full">
      <Suspense fallback={null}>
        <TerminalCanvas nodeId="local" rows={2} cols={3} />
      </Suspense>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';

import type { ComponentType } from 'react';

interface TerminalCanvasProps { nodeId: string; rows?: number; cols?: number; className?: string; }
const TerminalCanvas = dynamic(
  () => import('@/views/nodes/terminal').then(mod => mod.TerminalCanvas as ComponentType<TerminalCanvasProps>),
  { ssr: false }
) as ComponentType<TerminalCanvasProps>;

export default function TerminalTestPage() {
  return (
    <div className="h-screen w-full">
      <TerminalCanvas nodeId="local" rows={2} cols={3} />
    </div>
  );
}

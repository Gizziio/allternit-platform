'use client';

import dynamic from 'next/dynamic';

const TerminalCanvas = dynamic(
  () => import('@/views/nodes/terminal').then(mod => mod.TerminalCanvas),
  { ssr: false }
);

export default function TerminalTestPage() {
  return (
    <div className="h-screen w-full">
      <TerminalCanvas nodeId="local" rows={2} cols={3} />
    </div>
  );
}

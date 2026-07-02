'use client';

import { SwarmSetup } from '@/views/swarm/components/SwarmSetup';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('SwarmPreviewPage');

export default function SwarmPreviewPage() {
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#0a0908' }}>
      <SwarmSetup onLaunched={(id) => console.debug('launched:', id)} />
    </div>
  );
}

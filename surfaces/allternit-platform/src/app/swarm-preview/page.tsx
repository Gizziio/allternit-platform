'use client';

import { SwarmSetup } from '@/views/swarm/components/SwarmSetup';

export default function SwarmPreviewPage() {
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#0a0908' }}>
      <SwarmSetup onLaunched={(id) => console.log('launched:', id)} />
    </div>
  );
}

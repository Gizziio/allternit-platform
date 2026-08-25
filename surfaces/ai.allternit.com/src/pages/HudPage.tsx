'use client';

import React, { lazy, Suspense } from 'react';

const HudApp = lazy(
  () => import('../shell/hud/HudApp').then((mod) => ({ default: mod.HudApp })),
);

function HudLoader() {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-transparent">
      <div className="size-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
    </div>
  );
}

export default function HudPage() {
  return (
    <Suspense fallback={<HudLoader />}>
      <HudApp />
    </Suspense>
  );
}

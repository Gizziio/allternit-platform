"use client";

import { lazy, Suspense } from 'react';
import { isBotComputerLocation } from '@/lib/open-bot-computer-window';

const ShellApp = lazy(
  () => import('../shell/ShellApp').then((mod) => ({ default: mod.ShellApp }))
);
const BotComputerPage = lazy(() => import('./BotComputerPage'));

function Loading({ label }: { label: string }) {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0F0C0A] text-[#D4B08C] gap-4">
      <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[#D4B08C] rounded-full animate-spin" />
      <span className="text-[14px] font-medium tracking-wider">{label}</span>
    </div>
  );
}

export default function ShellPage() {
  const computer =
    typeof window !== 'undefined' &&
    isBotComputerLocation(window.location.pathname, window.location.search);

  if (computer) {
    return (
      <Suspense fallback={<Loading label="Opening computer…" />}>
        <BotComputerPage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Loading label="Loading Allternit…" />}>
      <ShellApp />
    </Suspense>
  );
}

"use client";

import { lazy, Suspense } from 'react';

const ShellApp = lazy(
  () => import('../shell/ShellApp').then((mod) => ({ default: mod.ShellApp }))
);

export default function ShellPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0F0C0A] text-[var(--accent-primary)] gap-4">
          <div className="size-8 border-2 border-solid border-[rgba(212,176,140,0.2)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
          <span className="text-[14px] font-medium tracking-wider">
            Loading Allternit…
          </span>
        </div>
      }
    >
      <ShellApp />
    </Suspense>
  );
}

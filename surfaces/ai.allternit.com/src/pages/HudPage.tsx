'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GlobalDropzoneProvider } from '@/components/GlobalDropzone';
import { getSession, type Session } from '@/lib/auth-browser';
import { SessionProvider } from '@/providers/session-provider';
import { VoiceProvider } from '@/providers/voice-provider';
import { ModeProvider } from '@/providers/mode-provider';

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
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

  return (
    <Suspense fallback={<HudLoader />}>
      <TooltipProvider>
        <VoiceProvider>
          <ModeProvider defaultMode="chat">
            <SessionProvider session={session}>
              <GlobalDropzoneProvider>
                <HudApp />
              </GlobalDropzoneProvider>
            </SessionProvider>
          </ModeProvider>
        </VoiceProvider>
      </TooltipProvider>
    </Suspense>
  );
}

import { useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GlobalDropzoneProvider } from '@/components/GlobalDropzone';
import { getSession } from '@/lib/auth-browser';
import { SessionProvider } from '@/providers/session-provider';
import { VoiceProvider } from '@/providers/voice-provider';
import { ModeProvider } from '@/providers/mode-provider';
import DesignModeView from '@/views/design/DesignModeView';

export default function DesignPage() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>>>(null);
  // Deep-link entry (gizzi-code `/design [prompt]`, desktop allternit://design
  // handler): carry the prompt from the URL into the studio composer.
  const [initialPrompt] = useState(() => {
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('prompt') ?? undefined;
  });

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

  return (
    <TooltipProvider>
      <VoiceProvider>
        <ModeProvider defaultMode="design">
          <SessionProvider session={session}>
            <GlobalDropzoneProvider>
              <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
                <DesignModeView initialPrompt={initialPrompt} />
              </main>
            </GlobalDropzoneProvider>
          </SessionProvider>
        </ModeProvider>
      </VoiceProvider>
    </TooltipProvider>
  );
}

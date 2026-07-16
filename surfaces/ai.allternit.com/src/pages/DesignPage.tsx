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
                <DesignModeView />
              </main>
            </GlobalDropzoneProvider>
          </SessionProvider>
        </ModeProvider>
      </VoiceProvider>
    </TooltipProvider>
  );
}

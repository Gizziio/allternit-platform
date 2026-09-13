import { useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GlobalDropzoneProvider } from '@/components/GlobalDropzone';
import { getSession } from '@/lib/auth-browser';
import { SessionProvider } from '@/providers/session-provider';
import { VoiceProvider } from '@/providers/voice-provider';
import { ModeProvider } from '@/providers/mode-provider';
import { useThemeStore, useResolvedTheme } from '@/design/ThemeStore';
import { OfficeDesktopView } from '@/views/office/OfficeDesktopView';

export default function OfficePage() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>>>(null);

  useEffect(() => {
    void getSession().then(setSession);
  }, []);

  // The popped-out window never mounts ShellApp, which is what normally
  // applies the persisted theme to data-theme — without it the base :root
  // tokens (warm light) paint the header/surfaces tan regardless of the
  // user's choice. Mirror ShellApp's effect so the office window follows the
  // same theme as the main shell (the theme store is shared localStorage).
  const themePreference = useThemeStore((state) => state.theme);
  const theme = useResolvedTheme(themePreference);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <TooltipProvider>
      <VoiceProvider>
        <ModeProvider defaultMode="browser">
          <SessionProvider session={session}>
            <GlobalDropzoneProvider>
              <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
                <OfficeDesktopView />
              </main>
            </GlobalDropzoneProvider>
          </SessionProvider>
        </ModeProvider>
      </VoiceProvider>
    </TooltipProvider>
  );
}

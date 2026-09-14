import React, { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { BotPickerHost } from '@/views/bots/BotPickerHost';
import { BotsChatPage } from './pages/BotsChatPage';
import type { ApprovalRequest } from '@/components/bot-chat/types';
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { PlatformSignIn, PlatformSignUp } from '@/lib/platform-auth-client';
import type { BeforeInstallPromptEvent } from './types';

export function FabricSessionApp(): React.ReactNode {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [view, setView] = useState<'dashboard' | 'chat'>('dashboard');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [pendingByBot, setPendingByBot] = useState<Record<string, boolean>>({});
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !("serviceWorker" in navigator)) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const pushWorkerUrl =
      import.meta.env.VITE_FABRIC_SESSION_PUSH_URL ||
      import.meta.env.VITE_REMOTE_CONTROL_PUSH_URL ||
      'https://push.fabrictransport.allternit.com';

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isSafari) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs.forEach((reg) => void reg.unregister())
      })
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      }
    }
<<<<<<<< HEAD:surfaces/ai.allternit.com/src/remote-control/App.tsx
      import.meta.env.VITE_REMOTE_CONTROL_PUSH_URL ?? 'https://push.fabrictransport.allternit.com';
========
      import.meta.env.VITE_FABRIC_SESSION_PUSH_URL ||
      import.meta.env.VITE_REMOTE_CONTROL_PUSH_URL ||
      'https://push.fabric-session.allternit.com';
>>>>>>>> archive/2026-09-13/wip/fabric-transport-bridge-removal:surfaces/ai.allternit.com/src/fabric-session/App.tsx

    navigator.serviceWorker
      .register('/fabric-session-service-worker.js')
      .then((reg) => {
        console.log('[Fabric Session] service worker registered:', reg.scope);
        // Tell the service worker where to fetch pending payloads. This is
        // required when the dashboard (Pages origin) and push worker are on
        // different subdomains.
        reg.active?.postMessage({ type: 'SET_PUSH_WORKER_URL', url: pushWorkerUrl });
        reg.installing?.addEventListener('statechange', function () {
          if (this.state === 'activated') {
            this.postMessage({ type: 'SET_PUSH_WORKER_URL', url: pushWorkerUrl });
          }
        });
      })
      .catch((err) => {
        console.warn('[Fabric Session] service worker registration failed:', err);
      });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleSelectBot = useCallback((botId: string) => {
    setSelectedBotId(botId);
    setView('chat');
  }, []);

  const handleApprovalsChange = useCallback((botId: string, pending: ApprovalRequest[]) => {
    setPendingByBot((prev) => ({ ...prev, [botId]: pending.length > 0 }));
  }, []);

  if (view === 'chat' && selectedBotId) {
    return (
      <>
        <BotPickerHost />
        <BotsChatPage
          botId={selectedBotId}
          onBack={() => {
            setView('dashboard');
            setSelectedBotId(null);
          }}
          onApprovalsChange={handleApprovalsChange}
          watching={watching}
          onToggleWatch={() => setWatching((v) => !v)}
        />
      </>
    );
  }

  return (
    <>
      <BotPickerHost />
      <DashboardPage
        installPrompt={installPrompt}
        onInstallClick={handleInstall}
        onSelectBot={handleSelectBot}
        pendingByBot={pendingByBot}
        watching={watching}
        onToggleWatch={() => setWatching((v) => !v)}
      />
    </>
  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          <div
            className="min-h-screen w-full flex items-center justify-center px-5"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          >
            <PlatformSignIn forceRedirectUrl="/" signUpForceRedirectUrl="/" />
          </div>
        }
      />
      <Route
        path="/sign-up"
        element={
          <div
            className="min-h-screen w-full flex items-center justify-center px-5"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          >
            <PlatformSignUp forceRedirectUrl="/" signInForceRedirectUrl="/" />
          </div>
        }
      />
      <Route path="/" element={<DashboardPage installPrompt={installPrompt} onInstallClick={handleInstall} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import React, { useEffect, useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import type { BeforeInstallPromptEvent } from './types';

export function RemoteControlApp(): React.ReactNode {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !("serviceWorker" in navigator)) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const pushWorkerUrl =
      import.meta.env.VITE_REMOTE_CONTROL_PUSH_URL ?? 'https://push.remotecontrol.allternit.com';

    navigator.serviceWorker
      .register('/remote-control-service-worker.js')
      .then((reg) => {
        console.log('[Remote Control] service worker registered:', reg.scope);
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
        console.warn('[Remote Control] service worker registration failed:', err);
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

  return (
    <>
      <DashboardPage installPrompt={installPrompt} onInstallClick={handleInstall} />
    </>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowSquareOut, Bell, Check, Spinner } from '@phosphor-icons/react';
import { useSettingsState } from '@/hooks/useSettingsState';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SettingsCard, SettingsCardRow } from '@/components/settings/SettingsCard';
import { Toggle } from '@/components/settings/Toggle';
import { QUIET_BUTTON_CLASS } from '@/components/settings/buttonStyles';
import { useToast } from '@/hooks/use-toast';
import { useRuntimes } from '@/components/dispatch/useRuntimes';
import { useRemotePendingCounts } from '@/components/dispatch/useRemotePendingCounts';
import { createRemoteControlClient } from '@/lib/dispatch/remote-control';
import { openFabricSessionWindow } from '@/lib/open-fabric-session-window';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { cn } from '@/lib/utils';

export function DispatchSettingsPanel(): React.ReactNode {
  const { addToast } = useToast();
  const auth = usePlatformAuth();
  const getToken = useMemo(() => auth.getToken.bind(auth), [auth]);
  const [keepAwake, setKeepAwake] = useSettingsState('dispatch.keepAwake', false);
  const [notifications, setNotifications] = useSettingsState('dispatch.notifications', false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  const { runtimes, loading: runtimesLoading, error: runtimesError, refresh } = useRuntimes();
  const thisNode = useMemo(
    () => runtimes.find((rt) => rt.name === 'This desktop') ?? runtimes[0] ?? null,
    [runtimes],
  );
  const { permissions: pendingPermissions, questions: pendingQuestions, loading: pendingLoading } =
    useRemotePendingCounts(runtimes, getToken);

  const pushClient = useMemo(
    () => (thisNode ? createRemoteControlClient({ runtimeId: thisNode.id, getToken }) : null),
    [thisNode, getToken],
  );
  const pushSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!pushSupported) return;
    void navigator.serviceWorker.ready.then((registration) => {
      void registration.pushManager.getSubscription().then((subscription) => {
        setPushEnabled(!!subscription);
      });
    });
  }, [pushSupported]);

  // Mirror the persisted `dispatch.notifications` pref onto real push state on
  // mount so the toggle reflects the actual subscription.
  useEffect(() => {
    if (!pushSupported || !pushClient) return;
    void navigator.serviceWorker.ready.then((registration) => {
      void registration.pushManager.getSubscription().then((subscription) => {
        setNotifications(!!subscription);
      });
    });
  }, [pushSupported, pushClient, setNotifications]);

  useEffect(() => {
    if (!keepAwake) {
      wakeLock?.release().catch(() => {});
      setWakeLock(null);
      return;
    }
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((lock: WakeLockSentinel) => {
        setWakeLock(lock);
        lock.addEventListener('release', () => setWakeLock(null));
      }).catch(() => {});
    }
  }, [keepAwake, wakeLock]);

  // Real push flow — mirrors RemoteSessionPanel.handlePushToggle: state from
  // registration.pushManager.getSubscription(); subscribe via
  // client.getVapidPublicKey() + pushManager.subscribe + client.subscribePush.
  const handleNotificationsToggle = async (v: boolean) => {
    if (!pushSupported || !pushClient) {
      addToast({ title: 'Not supported', description: 'Push notifications are not available in this build.', type: 'error' });
      return;
    }
    setPushLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      if (!v) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await pushClient.unsubscribePush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setPushEnabled(false);
        setNotifications(false);
        addToast({ title: 'Notifications off', description: 'Push notifications disabled for this runtime.', type: 'success' });
      } else {
        const vapidKey = await pushClient.getVapidPublicKey().catch(() => null);
        if (!vapidKey) {
          addToast({ title: 'Not configured', description: 'Push worker is not configured.', type: 'error' });
          return;
        }
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });
        const subJson = subscription.toJSON();
        if (!subJson.endpoint) throw new Error('Push subscription is missing an endpoint');
        await pushClient.subscribePush({
          endpoint: subJson.endpoint,
          expirationTime: subJson.expirationTime ?? null,
          keys: subJson.keys,
        });
        setPushEnabled(true);
        setNotifications(true);
        addToast({ title: 'Notifications on', description: 'You will receive push notifications for this runtime.', type: 'success' });
      }
    } catch (error) {
      addToast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to toggle push notifications', type: 'error' });
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading>Fabric Transport</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed -mt-3">
        Fabric Transport lets this computer join the Allternit fabric as a node for peers, leases, and session-worker calls.
      </p>

      <SettingsCard title="This node">
        {runtimesLoading ? (
          <div className="px-4 py-6 flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
            <Spinner size={16} className="animate-spin" /> Loading runtimes…
          </div>
        ) : runtimesError ? (
          <div className="px-4 py-3">
            <div className="text-[13px] text-[var(--status-error)]">{runtimesError}</div>
            <button type="button" className={QUIET_BUTTON_CLASS} onClick={refresh}>Retry</button>
          </div>
        ) : !thisNode ? (
          <div className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
            No runtime found for this machine. Pair a device from the Devices panel to join the fabric.
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center gap-3">
            <span className={cn(
              "size-2.5 rounded-full shrink-0",
              thisNode.status === 'online' ? "bg-[var(--status-success)]" :
              thisNode.status === 'busy' ? "bg-[var(--status-warning)]" : "bg-[var(--ui-text-muted)]"
            )} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-[var(--text-primary)]">{thisNode.name}</div>
              <div className="text-[12px] text-[var(--text-tertiary)] truncate">
                {thisNode.host}{thisNode.id ? ` · ${thisNode.id}` : ''}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--status-success)]">
              <Check size={14} weight="bold" /> {thisNode.status}
            </span>
          </div>
        )}
        <SettingsCardRow
          label="Pending approvals"
          description="Permission requests waiting on this node."
        >
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            {pendingLoading ? '…' : pendingPermissions}
          </span>
        </SettingsCardRow>
        <SettingsCardRow
          label="Pending questions"
          description="Questions from machines waiting for an answer."
        >
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            {pendingLoading ? '…' : pendingQuestions}
          </span>
        </SettingsCardRow>
        <div className="px-4 py-3 border-t border-solid border-[var(--border-subtle)]">
          <button type="button" className={QUIET_BUTTON_CLASS} onClick={() => openFabricSessionWindow(thisNode?.id)}>
            <ArrowSquareOut size={14} /> Open Fabric dashboard
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Notifications">
        <SettingsCardRow
          label="Keep computer awake"
          description="Prevent sleep while Fabric Transport is running."
        >
          <Toggle value={keepAwake} onChange={setKeepAwake} />
        </SettingsCardRow>
        <SettingsCardRow
          label="Push notifications"
          description="Receive push notifications for this runtime's sessions, even when the window is closed."
        >
          {pushLoading ? (
            <Spinner size={16} className="animate-spin" />
          ) : (
            <Toggle value={pushEnabled || notifications} onChange={(v) => void handleNotificationsToggle(v)} />
          )}
        </SettingsCardRow>
      </SettingsCard>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

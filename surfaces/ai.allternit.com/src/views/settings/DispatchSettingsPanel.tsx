"use client";

import React, { useState, useEffect } from 'react';
import { Coffee, Bell, Monitor, Code, Folder, Check } from '@phosphor-icons/react';
import { useSettingsState } from '@/hooks/useSettingsState';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SettingsCard, SettingsCardRow } from '@/components/settings/SettingsCard';
import { Toggle } from '@/components/settings/Toggle';
import { cn } from '@/lib/utils';
import {
  CodePermissionsDropdown,
  type CodePermissionOption,
} from '@/components/dispatch/CodePermissionsDropdown';

export function DispatchSettingsPanel(): React.ReactNode {
  const [fileAccess, setFileAccess] = useSettingsState('dispatch.fileAccess', true);
  const [keepAwake, setKeepAwake] = useSettingsState('dispatch.keepAwake', false);
  const [notifications, setNotifications] = useSettingsState('dispatch.notifications', false);
  const [computerControl, setComputerControl] = useSettingsState('dispatch.computerControl', false);
  const [accessibilityGranted, setAccessibilityGranted] = useSettingsState('dispatch.accessibility', true);
  const [screenRecordingGranted, setScreenRecordingGranted] = useSettingsState('dispatch.screenRecording', false);
  const [codePermission, setCodePermission] = useSettingsState<CodePermissionOption>('dispatch.codePermission', 'manual');
  const [setupComplete, setSetupComplete] = useSettingsState('dispatch.setupComplete', false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

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
  }, [keepAwake]);

  const handleNotificationsToggle = async (v: boolean) => {
    if (v && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifications(perm === 'granted');
    } else {
      setNotifications(v);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading>Dispatch</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed -mt-3">
        Dispatch lets you hand off tasks from the Allternit mobile app to this computer.
      </p>

      <SettingsCard title="Permissions">
        <SettingsCardRow
          label="File access"
          description="Allow Allternit to read and write files on this computer."
        >
          <Toggle value={fileAccess} onChange={setFileAccess} />
        </SettingsCardRow>
        <SettingsCardRow
          label="Keep computer awake"
          description="Prevent sleep while Dispatch is running."
        >
          <Toggle value={keepAwake} onChange={setKeepAwake} />
        </SettingsCardRow>
        <SettingsCardRow
          label="Mobile notifications"
          description="Show phone-style notifications for Dispatch messages."
        >
          <Toggle value={notifications} onChange={handleNotificationsToggle} />
        </SettingsCardRow>
        <SettingsCardRow
          label="Computer use"
          description="Allow Allternit to click, type, and open apps."
        >
          <Toggle
            value={computerControl}
            onChange={(v) => {
              setComputerControl(v);
              if (v && !accessibilityGranted) setAccessibilityGranted(true);
            }}
          />
        </SettingsCardRow>
        {computerControl && (
          <div className="px-4 pb-4 space-y-3 border-t border-solid border-[var(--border-subtle)]">
            <SubPermission
              label="Accessibility"
              description="Required for mouse and keyboard control."
              granted={accessibilityGranted}
              onRequest={() => setAccessibilityGranted(true)}
            />
            <SubPermission
              label="Screen recording"
              description="Required for screen visibility. macOS may ask you to restart Allternit."
              granted={screenRecordingGranted}
              onRequest={() => setScreenRecordingGranted(true)}
            />
          </div>
        )}
        <div className="px-4 py-3 border-t border-solid border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code size={18} className="text-[var(--text-tertiary)]" />
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">Code permissions</div>
                <div className="text-[12px] text-[var(--text-tertiary)]">What to do when Dispatch wants to run code.</div>
              </div>
            </div>
            <CodePermissionsDropdown value={codePermission} onChange={setCodePermission} />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Setup">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-[13px] text-[var(--text-secondary)]">
            {setupComplete ? 'Dispatch setup is complete.' : 'Dispatch setup has not been finished.'}
          </div>
          <button
            type="button"
            onClick={() => setSetupComplete(!setupComplete)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border transition-colors',
              setupComplete
                ? 'border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] bg-transparent'
                : 'border-transparent bg-[var(--text-primary)] text-[var(--bg-elevated)] hover:opacity-90'
            )}
          >
            {setupComplete ? 'Reconfigure setup' : 'Finish setup'}
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}

function SubPermission({
  label,
  description,
  granted,
  onRequest,
}: {
  label: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pt-3">
      <div>
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-tertiary)]">{description}</div>
      </div>
      {granted ? (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--status-success)]">
          <Check size={14} weight="bold" /> Granted
        </span>
      ) : (
        <button
          type="button"
          onClick={onRequest}
          className="px-3 py-1 rounded-lg border border-solid border-[var(--border-default)] bg-transparent text-[12px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
        >
          Request
        </button>
      )}
    </div>
  );
}

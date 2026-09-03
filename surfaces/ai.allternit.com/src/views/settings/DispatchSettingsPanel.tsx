"use client";

import React, { useState, useEffect } from 'react';
import { Monitor, Code, Folder, Check } from '@phosphor-icons/react';
import { useSettingsState } from '@/hooks/useSettingsState';
import { SectionHeading } from '@/components/settings/SectionHeading';
import { SettingsCard, SettingsCardRow } from '@/components/settings/SettingsCard';
import { Toggle } from '@/components/settings/Toggle';
import {
  CodePermissionsDropdown,
  type CodePermissionOption,
} from '@/components/dispatch/CodePermissionsDropdown';

export function DispatchSettingsPanel(): React.ReactNode {
  const [keepAwake, setKeepAwake] = useSettingsState('dispatch.keepAwake', false);
  const [notifications, setNotifications] = useSettingsState('dispatch.notifications', false);
  const [notifyPermission, setNotifyPermission] = useSettingsState('dispatch.notifyPermission', true);
  const [notifyQuestion, setNotifyQuestion] = useSettingsState('dispatch.notifyQuestion', true);
  const [notifyCompleted, setNotifyCompleted] = useSettingsState('dispatch.notifyCompleted', false);
  const [notifyError, setNotifyError] = useSettingsState('dispatch.notifyError', true);
  const [codePermission, setCodePermission] = useSettingsState<CodePermissionOption>('dispatch.codePermission', 'manual');
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
  }, [keepAwake, wakeLock]);

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
      <SectionHeading>Fabric Session</SectionHeading>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed -mt-3">
        Fabric Session lets you hand off tasks from the Allternit mobile app to this computer through capability-native harness access.
      </p>

      <SettingsCard title="Permissions">
        <InfoRow
          icon={<Folder size={18} />}
          label="File access"
          description="Granted by the Allternit desktop app during pairing."
        />
        <SettingsCardRow
          label="Keep computer awake"
          description="Prevent sleep while Fabric Session is running."
        >
          <Toggle value={keepAwake} onChange={setKeepAwake} />
        </SettingsCardRow>
        <SettingsCardRow
          label="Mobile notifications"
          description="Show phone-style notifications for Fabric Session messages."
        >
          <Toggle value={notifications} onChange={handleNotificationsToggle} />
        </SettingsCardRow>
        {notifications && (
          <div className="px-4 pb-4 space-y-3 border-t border-solid border-[var(--border-subtle)]">
            <SubSettingRow
              label="Permission requests"
              description="Notify when a machine needs permission approval."
              value={notifyPermission}
              onChange={setNotifyPermission}
            />
            <SubSettingRow
              label="Questions"
              description="Notify when a machine asks a question."
              value={notifyQuestion}
              onChange={setNotifyQuestion}
            />
            <SubSettingRow
              label="Completed tasks"
              description="Notify when a machine finishes a task."
              value={notifyCompleted}
              onChange={setNotifyCompleted}
            />
            <SubSettingRow
              label="Errors"
              description="Notify when a machine reports an error."
              value={notifyError}
              onChange={setNotifyError}
            />
          </div>
        )}
        <InfoRow
          icon={<Monitor size={18} />}
          label="Computer use"
          description="Allows Allternit to click, type, and open apps on the host machine."
        />
        <div className="px-4 pb-4 space-y-3 border-t border-solid border-[var(--border-subtle)]">
          <SubPermission
            label="Accessibility"
            description="Required for mouse and keyboard control."
            href="x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
          />
          <SubPermission
            label="Screen recording"
            description="Required for screen visibility. macOS may ask you to restart Allternit."
            href="x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
          />
        </div>
        <div className="px-4 py-3 border-t border-solid border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Code size={18} className="text-[var(--text-tertiary)]" />
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)]">Code permissions</div>
                <div className="text-[12px] text-[var(--text-tertiary)]">What to do when a Fabric Session wants to run code.</div>
              </div>
            </div>
            <CodePermissionsDropdown value={codePermission} onChange={setCodePermission} />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

function SubPermission({
  label,
  description,
  href,
}: {
  label: string;
  description: string;
  href?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pt-3">
      <div>
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-tertiary)]">{description}</div>
      </div>
      {href ? (
        <a
          href={href}
          className="px-3 py-1 rounded-lg border border-solid border-[var(--border-default)] bg-transparent text-[12px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors no-underline shrink-0"
        >
          Open System Settings
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--status-success)]">
          <Check size={14} weight="bold" /> Granted
        </span>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className="text-[var(--text-tertiary)]">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-tertiary)]">{description}</div>
      </div>
      <Check size={18} className="text-[var(--text-secondary)] shrink-0" weight="bold" />
    </div>
  );
}

function SubSettingRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pt-3">
      <div>
        <div className="text-[13px] font-medium text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-tertiary)]">{description}</div>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

"use client";

import React, { useState } from 'react';
import {
  Folder,
  Coffee,
  Globe,
  Monitor,
  SquaresFour,
  Check,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useSettingsState } from '@/hooks/useSettingsState';
import { RemoteControlHub } from '@/components/dispatch/RemoteControlHub';

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none',
        checked ? 'bg-blue-500' : 'bg-[var(--border-default)]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ─── Setup row (toggle or checkmark) ─────────────────────────────────────────
type RowVariant = 'toggle' | 'check';

interface SetupRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: RowVariant;
  checked?: boolean;
  onToggle?: (v: boolean) => void;
  children?: React.ReactNode;
}

function SetupRow({ icon, title, description, variant, checked, onToggle, children }: SetupRowProps) {
  return (
    <div className="rounded-2xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 p-5">
        <div className="text-[var(--text-secondary)] shrink-0 size-6 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--text-primary)]">{title}</div>
          <div className="text-[13px] text-[var(--text-tertiary)] mt-0.5">{description}</div>
        </div>
        {variant === 'toggle' && (
          <ToggleSwitch checked={!!checked} onChange={onToggle ?? (() => {})} />
        )}
        {variant === 'check' && (
          <Check size={18} className="text-[var(--text-secondary)] shrink-0" weight="bold" />
        )}
      </div>
      {children && (
        <div className="px-5 pb-5 pt-0 border-t border-solid border-[var(--border-subtle)]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── SubPermissionRow ─────────────────────────────────────────────────────────
interface SubPermRow {
  label: string;
  description: string;
  granted: boolean;
  onRequest?: () => void;
}

function SubPermissionRow({ label, description, granted, onRequest }: SubPermRow) {
  return (
    <div className="flex items-start gap-3 pt-4">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">{description}</div>
      </div>
      {granted ? (
        <Check size={16} className="text-[var(--text-secondary)] mt-0.5 shrink-0" weight="bold" />
      ) : (
        <button
          type="button"
          onClick={onRequest}
          className="px-3.5 py-1.5 rounded-xl border border-solid border-[var(--border-default)] bg-[var(--bg-elevated)] text-[12px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors shrink-0"
        >
          Request
        </button>
      )}
    </div>
  );
}

// ─── Phone ↔ laptop illustration ──────────────────────────────────────────────
function PhoneLaptopIllustration() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Phone */}
      <div className="relative w-[38px] h-[66px] rounded-[10px] border-2 border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm flex flex-col items-center pt-2.5 px-1.5 pb-1.5">
        <div className="w-full flex flex-col gap-1 mb-2">
          <div className="w-full h-1.5 bg-[var(--border-subtle)] rounded-sm" />
          <div className="w-3/4 h-1.5 bg-[var(--border-subtle)] rounded-sm" />
        </div>
        <div className="w-5 h-4 rounded-sm bg-[var(--border-subtle)] mb-1" />
        <div className="mt-auto w-6 h-2 rounded-full bg-[var(--border-subtle)]" />
      </div>

      {/* Curly cord */}
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" className="text-[#d4856a]">
        <path
          d="M2 12 C6 4, 12 4, 16 12 C20 20, 26 20, 30 12 C34 4, 40 4, 46 12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Laptop */}
      <div className="relative w-[74px] h-[52px] flex flex-col items-center">
        <div className="w-full h-[42px] rounded-[8px] border-2 border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-sm flex items-center justify-center relative overflow-hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--text-tertiary)]">
            <path d="M4.5 2L10.5 14L13 9L19 8L4.5 2Z" />
          </svg>
        </div>
        <div className="w-[88px] h-[6px] rounded-b-[4px] border-b-2 border-l-2 border-r-2 border-[var(--border-default)] bg-[var(--bg-elevated)] mt-[-2px]" />
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function DispatchView(): React.ReactNode {
  const [fileAccess, setFileAccess] = useSettingsState('dispatch.fileAccess', true);
  const [keepAwake, setKeepAwake] = useSettingsState('dispatch.keepAwake', false);
  const [computerControl, setComputerControl] = useSettingsState('dispatch.computerControl', false);
  const [setupComplete, setSetupComplete] = useSettingsState('dispatch.setupComplete', false);

  const [accessibilityGranted] = useSettingsState('dispatch.accessibility', true);
  const [screenRecordingGranted, setScreenRecordingGranted] = useSettingsState('dispatch.screenRecording', false);

  // Acquire / release wake lock when keepAwake changes
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  React.useEffect(() => {
    if (!keepAwake) {
      wakeLock?.release().catch(() => {});
      setWakeLock(null);
      return;
    }
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock
        .request('screen')
        .then((lock: WakeLockSentinel) => {
          setWakeLock(lock);
          lock.addEventListener('release', () => setWakeLock(null));
        })
        .catch(() => {});
    }
  }, [keepAwake]);

  if (!setupComplete) {
    return (
      <div className="h-full w-full overflow-y-auto bg-[var(--bg-elevated)] text-[var(--text-primary)] flex flex-col">
        <div className="w-full max-w-lg mx-auto px-8 pt-10 pb-14 flex flex-col items-center">
          <div className="mb-6">
            <PhoneLaptopIllustration />
          </div>

          <h1
            className="text-3xl font-medium tracking-tight text-[var(--text-primary)] m-0 mb-2 text-center"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Get ready to dispatch
          </h1>
          <p className="text-[14px] text-[var(--text-tertiary)] m-0 mb-8 text-center">
            Update these anytime in{' '}
            <button
              type="button"
              className="text-blue-500 underline bg-transparent border-none cursor-pointer p-0 text-[14px]"
              onClick={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'dispatch' } }))}
            >
              Settings
            </button>
            .
          </p>

          <div className="w-full flex flex-col gap-3">
            <SetupRow
              icon={<Folder size={20} />}
              title="Give Allternit access to your files"
              description="macOS will ask when you click Finish."
              variant="toggle"
              checked={fileAccess}
              onToggle={setFileAccess}
            />
            <SetupRow
              icon={<Coffee size={20} />}
              title="Keep this computer awake"
              description="Prevents sleep while Dispatch is running."
              variant="toggle"
              checked={keepAwake}
              onToggle={setKeepAwake}
            />
            <SetupRow
              icon={<Globe size={20} />}
              title="Allternit is ready to use Chrome"
              description="Lets Dispatch navigate, click, and fill forms in your browser."
              variant="check"
            />
            <SetupRow
              icon={<Monitor size={20} />}
              title="Let Allternit control your computer"
              description="Allows Allternit to click, type, and open apps."
              variant="toggle"
              checked={computerControl}
              onToggle={(v) => {
                setComputerControl(v);
                if (v && !accessibilityGranted) setScreenRecordingGranted(true);
              }}
            >
              {computerControl && (
                <div className="divide-y divide-[var(--border-subtle)]">
                  <SubPermissionRow
                    label="Accessibility"
                    description="Required for mouse and keyboard tracking and control."
                    granted={accessibilityGranted}
                  />
                  <SubPermissionRow
                    label="Screen recording"
                    description="Required for screen visibility. macOS may ask you to restart Allternit."
                    granted={screenRecordingGranted}
                    onRequest={() => setScreenRecordingGranted(true)}
                  />
                </div>
              )}
            </SetupRow>
            <SetupRow
              icon={<SquaresFour size={20} />}
              title="All connectors are on"
              description="Dispatch can use every connector you've authenticated."
              variant="check"
            />
          </div>

          <button
            type="button"
            onClick={() => setSetupComplete(true)}
            className="mt-8 w-full py-3.5 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-elevated)] text-[15px] font-semibold cursor-pointer border-none hover:opacity-90 transition-opacity"
          >
            Finish setup
          </button>
        </div>
      </div>
    );
  }

  return <RemoteControlHub />;
}

export default DispatchView;

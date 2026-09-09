import { useState } from 'react';
import type { ReactNode } from 'react';
import { useOfficeHost } from '../bridge/OfficeHostContext';
import type {
  OfficeAppKey,
  OfficeExtensionContext,
} from '../bridge/types';
import { AllternitBrandMark } from '../components/AllternitBrandMark';
import './OfficeAiSlot.css';

function tabStorageKey(appKey: OfficeAppKey): string {
  return `allternit:office-ai-slot-tab:${appKey}`;
}

function loadActiveTab(appKey: OfficeAppKey, validIds: string[]): string {
  try {
    if (typeof window === 'undefined') return validIds[0] ?? '';
    const saved = window.localStorage.getItem(tabStorageKey(appKey));
    return saved && validIds.includes(saved) ? saved : (validIds[0] ?? '');
  } catch {
    return validIds[0] ?? '';
  }
}

function saveActiveTab(appKey: OfficeAppKey, tabId: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(tabStorageKey(appKey), tabId);
  } catch {
    /* storage unavailable */
  }
}

export interface OfficeAiSlotProps {
  /** The office app whose AI chat section this slot occupies. */
  appKey: OfficeAppKey;
  /**
   * The app's built-in AI panel, exactly as it was rendered before the slot
   * existed. Rendered unchanged when the host registered no extensions. When
   * extensions ARE registered the agent panes are the only chat surface, so
   * the built-in panel is not mounted.
   */
  fallback: ReactNode;
  /**
   * True while the surrounding dock is collapsed to its slim rail. The slot
   * renders its own branded collapsed rail (with an expand control when
   * `expand` is provided) instead of the tab strip; every extension pane
   * stays mounted but hidden so re-expanding never drops panel state.
   */
  collapsed?: boolean;
  /** Expands the surrounding dock from the slot's collapsed rail. */
  expand?: () => void;
  /** Forwarded into the extension context so extensions can close the section. */
  close?: () => void;
  className?: string;
}

/**
 * Occupies the per-app AI chat section with the host's extensions.
 *
 * Decision rule: no registered extensions → render `fallback` exactly as
 * today. Otherwise the registered agent panes are the only chat surface
 * (one pane per extension, no built-in fallback tab); all panes stay mounted
 * and are toggled with the `hidden` attribute so extensions keep their state
 * across tab switches and dock collapse/expand.
 */
export function OfficeAiSlot({
  appKey,
  fallback,
  collapsed = false,
  expand,
  close,
  className,
}: OfficeAiSlotProps): ReactNode {
  const host = useOfficeHost();
  const extensions = host?.extensions ?? [];
  const [savedTab, setSavedTab] = useState<string | null>(() => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(tabStorageKey(appKey));
    } catch {
      return null;
    }
  });

  // No extensions registered: preserve the pre-slot behavior exactly.
  if (extensions.length === 0) {
    return <>{fallback}</>;
  }

  const active = extensions.some((e) => e.id === savedTab) ? savedTab! : extensions[0]!.id;
  const ctx: OfficeExtensionContext = close
    ? { appKey, host: host!, close }
    : { appKey, host: host! };

  const selectTab = (tabId: string): void => {
    setSavedTab(tabId);
    saveActiveTab(appKey, tabId);
  };

  const classes = ['office-ai-slot'];
  if (collapsed) classes.push('office-ai-slot-collapsed');
  if (className) classes.push(className);

  if (collapsed) {
    return (
      <div className={classes.join(' ')}>
        <button
          type="button"
          className="office-ext-rail"
          title="Expand Allternit Office Agent"
          onClick={expand}
          disabled={!expand}
        >
          <AllternitBrandMark size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={classes.join(' ')}>
      <div className="office-ext-tabs" role="tablist" aria-label="AI panel tabs">
        {extensions.map((ext) => (
          <button
            key={ext.id}
            type="button"
            role="tab"
            aria-selected={active === ext.id}
            className={
              active === ext.id ? 'office-ext-tab office-ext-tab-active' : 'office-ext-tab'
            }
            onClick={() => selectTab(ext.id)}
          >
            {ext.icon && (
              <span className="office-ext-tab-icon" aria-hidden>
                {ext.icon}
              </span>
            )}
            <span className="office-ext-tab-label">{ext.name}</span>
          </button>
        ))}
      </div>
      <div className="office-ext-body">
        {extensions.map((ext) => (
          <div
            key={ext.id}
            className="office-ext-pane"
            hidden={active !== ext.id}
          >
            {ext.render(ctx)}
          </div>
        ))}
      </div>
    </div>
  );
}

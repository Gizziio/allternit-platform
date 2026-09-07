import { useState } from 'react';
import type { ReactNode } from 'react';
import { useOfficeHost } from '../bridge/OfficeHostContext';
import type {
  OfficeAppKey,
  OfficeExtensionContext,
} from '../bridge/types';
import './OfficeAiSlot.css';

const BUILTIN_TAB_ID = 'builtin';

function tabStorageKey(appKey: OfficeAppKey): string {
  return `allternit:office-ai-slot-tab:${appKey}`;
}

function loadActiveTab(appKey: OfficeAppKey): string {
  try {
    if (typeof window === 'undefined') return BUILTIN_TAB_ID;
    return window.localStorage.getItem(tabStorageKey(appKey)) ?? BUILTIN_TAB_ID;
  } catch {
    return BUILTIN_TAB_ID;
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
   * existed. Rendered unchanged when the host registered no extensions, and
   * behind a "Built-in" tab otherwise.
   */
  fallback: ReactNode;
  /**
   * True while the surrounding dock is collapsed to its slim rail. The tab
   * strip is hidden and every extension pane stays mounted but hidden, so
   * switching tabs or re-expanding never drops panel state. The fallback
   * panel keeps ownership of the collapsed rail (docs/sheets/slides render
   * their own; pdf hides via CSS and the app renders one).
   */
  collapsed?: boolean;
  /** Forwarded into the extension context so extensions can close the section. */
  close?: () => void;
  className?: string;
}

/**
 * Occupies the per-app AI chat section with the host's extensions.
 *
 * Decision rule: no registered extensions → render `fallback` exactly as
 * today. Otherwise render a tab strip (one tab per extension plus a
 * "Built-in" tab) above the active panel. All panes stay mounted and are
 * toggled with the `hidden` attribute so built-in panels and extensions keep
 * their state (in-flight agent runs, chat history) across tab switches.
 */
export function OfficeAiSlot({
  appKey,
  fallback,
  collapsed = false,
  close,
  className,
}: OfficeAiSlotProps): ReactNode {
  const host = useOfficeHost();
  const extensions = host?.extensions;
  const [activeTab, setActiveTab] = useState<string>(() => loadActiveTab(appKey));

  // No extensions registered: preserve the pre-slot behavior exactly.
  if (!extensions || extensions.length === 0) {
    return <>{fallback}</>;
  }

  const active = activeTab !== BUILTIN_TAB_ID && extensions.some((e) => e.id === activeTab)
    ? activeTab
    : BUILTIN_TAB_ID;
  const ctx: OfficeExtensionContext = close
    ? { appKey, host: host!, close }
    : { appKey, host: host! };

  const selectTab = (tabId: string): void => {
    setActiveTab(tabId);
    saveActiveTab(appKey, tabId);
  };

  const classes = ['office-ai-slot'];
  if (collapsed) classes.push('office-ai-slot-collapsed');
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')}>
      {!collapsed && (
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
          <button
            type="button"
            role="tab"
            aria-selected={active === BUILTIN_TAB_ID}
            className={
              active === BUILTIN_TAB_ID
                ? 'office-ext-tab office-ext-tab-active'
                : 'office-ext-tab'
            }
            onClick={() => selectTab(BUILTIN_TAB_ID)}
          >
            <span className="office-ext-tab-label">Built-in</span>
          </button>
        </div>
      )}
      <div className="office-ext-body">
        <div
          className="office-ext-pane"
          hidden={!collapsed && active !== BUILTIN_TAB_ID}
        >
          {fallback}
        </div>
        {extensions.map((ext) => (
          <div
            key={ext.id}
            className="office-ext-pane"
            hidden={collapsed || active !== ext.id}
          >
            {ext.render(ctx)}
          </div>
        ))}
      </div>
    </div>
  );
}

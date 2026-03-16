import { HotkeysProvider, useHotkeys as useReactHotkeys } from 'react-hotkeys-hook';
import type { Options as UseHotkeysOptions } from 'react-hotkeys-hook';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';

// Re-export options type.
export type { UseHotkeysOptions };

// Define common platform shortcuts
export const PLATFORM_SHORTCUTS = {
  GLOBAL: {
    TOGGLE_AGENT_RUNNER: { keys: 'meta+shift+a', description: 'Toggle Agent Runner' },
    SEARCH: { keys: 'meta+k', description: 'Global Search' },
    NEW_CHAT: { keys: 'meta+n', description: 'New Chat' },
    TOGGLE_SIDEBAR: { keys: 'meta+b', description: 'Toggle Sidebar' },
  },
  // Sidecar is now integrated into Agent Runner - no separate shortcut needed
  SIDECAR: {
    TOGGLE: { keys: 'meta+shift+unused', description: 'Integrated into Agent Runner' },
  },
  CHANGESET: {
    ACCEPT: { keys: 'meta+y', description: 'Accept Current Change' },
    REJECT: { keys: 'meta+n', description: 'Reject Current Change' },
    NEXT: { keys: 'meta+down', description: 'Next Change' },
    PREV: { keys: 'meta+up', description: 'Previous Change' },
  },
  CHAT: {
    SEND_MESSAGE: { keys: 'enter', description: 'Send Message' },
    NEWLINE: { keys: 'shift+enter', description: 'New Line' },
    PREVIOUS_MESSAGE: { keys: 'ctrl+p', description: 'Previous Message' },
    NEXT_MESSAGE: { keys: 'ctrl+n', description: 'Next Message' },
  },
  // Legacy aliases kept for older callers/tests.
  AGENT_RUNNER: 'meta+shift+a',
  NAV_BACK: 'alt+left',
};

// Define hotkey scopes
export const HOTKEY_SCOPES = {
  GLOBAL: 'global',
  CHAT: 'chat',
  EDITOR: 'editor',
  NAVIGATION: 'navigation',
};

// Context for hotkey scopes
interface HotkeysContextType {
  activeScopes: string[];
  setActiveScopes: React.Dispatch<React.SetStateAction<string[]>>;
}

const HotkeysContext = createContext<HotkeysContextType | undefined>(undefined);

// Provider component for hotkey scopes
interface A2RHotkeysProviderProps {
  children: React.ReactNode;
  initiallyActiveScopes?: string[];
}

export const A2RHotkeysProvider: React.FC<A2RHotkeysProviderProps> = ({ 
  children, 
  initiallyActiveScopes = [HOTKEY_SCOPES.GLOBAL] 
}) => {
  const [activeScopes, setActiveScopes] = React.useState<string[]>(initiallyActiveScopes);

  return (
    <HotkeysProvider initiallyActiveScopes={initiallyActiveScopes}>
      <HotkeysContext.Provider value={{ activeScopes, setActiveScopes }}>
        {children}
      </HotkeysContext.Provider>
    </HotkeysProvider>
  );
};

const DISABLED_HOTKEY_SENTINEL = 'a2r-disabled-hotkey-sentinel';

function normalizeHotkeysInput(keys: string | string[] | undefined | null): string {
  if (Array.isArray(keys)) {
    return keys
      .map((key) => (typeof key === 'string' ? key.trim() : ''))
      .filter((key) => key.length > 0)
      .join(',');
  }

  if (typeof keys === 'string') {
    return keys.trim();
  }

  return '';
}

export const useHotkeys = (
  keys: string | string[] | undefined | null,
  callback: (event: KeyboardEvent, handler: unknown) => void,
  options?: UseHotkeysOptions,
  deps?: React.DependencyList,
) => {
  const normalized = normalizeHotkeysInput(keys);
  const enabledByOption = typeof options?.enabled === 'boolean' ? options.enabled : true;
  const enabled = Boolean(normalized) && enabledByOption;

  return useReactHotkeys(
    normalized || DISABLED_HOTKEY_SENTINEL,
    callback,
    {
      ...(options || {}),
      enabled,
    },
    deps,
  );
};

type ParsedHotkey = {
  key: string;
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
};

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');

function normalizeKeyToken(token: string): string {
  const value = token.trim().toLowerCase();
  switch (value) {
    case 'arrowup': return 'up';
    case 'arrowdown': return 'down';
    case 'arrowleft': return 'left';
    case 'arrowright': return 'right';
    case 'escape': return 'esc';
    case ' ': return 'space';
    default: return value;
  }
}

function parseHotkeyCombo(combo: string): ParsedHotkey | null {
  const parts = combo.split('+').map((token) => token.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let key: string | null = null;
  let meta = false;
  let ctrl = false;
  let alt = false;
  let shift = false;

  for (const part of parts) {
    const token = normalizeKeyToken(part);
    switch (token) {
      case 'cmd':
      case 'command':
      case 'meta':
        meta = true;
        break;
      case 'ctrl':
      case 'control':
        ctrl = true;
        break;
      case 'alt':
      case 'option':
        alt = true;
        break;
      case 'shift':
        shift = true;
        break;
      case 'mod':
        if (IS_MAC) {
          meta = true;
        } else {
          ctrl = true;
        }
        break;
      default:
        key = token;
        break;
    }
  }

  if (!key) return null;
  return { key, meta, ctrl, alt, shift };
}

function parseHotkeys(keys: string): ParsedHotkey[] {
  return keys
    .split(',')
    .map((combo) => parseHotkeyCombo(combo))
    .filter((combo): combo is ParsedHotkey => combo !== null);
}

function normalizeEventKey(key: string): string {
  const lower = (key || '').toLowerCase();
  switch (lower) {
    case 'arrowup': return 'up';
    case 'arrowdown': return 'down';
    case 'arrowleft': return 'left';
    case 'arrowright': return 'right';
    case 'escape': return 'esc';
    case ' ': return 'space';
    default: return lower;
  }
}

function matchesHotkey(event: KeyboardEvent, combo: ParsedHotkey): boolean {
  const eventKey = normalizeEventKey(event.key);
  if (eventKey !== combo.key) return false;
  if (event.metaKey !== combo.meta) return false;
  if (event.ctrlKey !== combo.ctrl) return false;
  if (event.altKey !== combo.alt) return false;
  if (event.shiftKey !== combo.shift) return false;
  return true;
}

// Hook to use platform hotkeys
export const useA2RHotkeys = (
  keys: string | undefined | null,
  callback: (e: KeyboardEvent) => void,
  deps?: any[],
  options?: UseHotkeysOptions,
) => {
  const normalizedKeys = typeof keys === 'string' ? keys.trim() : '';
  const parsedHotkeys = useMemo(
    () => (normalizedKeys ? parseHotkeys(normalizedKeys) : []),
    [normalizedKeys],
  );
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...(deps ?? [])]);

  useEffect(() => {
    const enabledByOption = typeof options?.enabled === 'boolean' ? options.enabled : true;
    if (!enabledByOption || parsedHotkeys.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!parsedHotkeys.some((hotkey) => matchesHotkey(event, hotkey))) {
        return;
      }
      if (options?.preventDefault) {
        event.preventDefault();
      }
      callbackRef.current(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [parsedHotkeys, options?.enabled, options?.preventDefault]);

  return undefined;
};

// Hook to manage hotkey scopes
export const useHotkeyScopes = () => {
  const context = useContext(HotkeysContext);
  if (!context) {
    throw new Error('useHotkeyScopes must be used within A2RHotkeysProvider');
  }
  return context;
};

// Export default if needed
export default useHotkeys;

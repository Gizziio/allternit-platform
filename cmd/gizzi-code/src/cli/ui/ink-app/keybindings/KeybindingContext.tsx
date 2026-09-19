// @ts-nocheck
// TODO(types): compiler-artifact decompile kept nocheck — see inline type errors (dead "external"/"ant" constant comparisons, unknown-typed tool result access, keybindings/types re-export drift).
import React, { createContext, type RefObject, useContext, useLayoutEffect, useMemo } from 'react';
import type { Key } from '../ink';
import { type ChordResolveResult, getBindingDisplayText, resolveKeyWithChordState } from './resolver';
import type { KeybindingContextName, ParsedBinding, ParsedKeystroke } from './types';

/** Handler registration for action callbacks */
type HandlerRegistration = {
  action: string;
  context: KeybindingContextName;
  handler: () => void;
};
type KeybindingContextValue = {
  /** Resolve a key input to an action name (with chord support) */
  resolve: (input: string, key: Key, activeContexts: KeybindingContextName[]) => ChordResolveResult;

  /** Update the pending chord state */
  setPendingChord: (pending: ParsedKeystroke[] | null) => void;

  /** Get display text for an action (e.g., "ctrl+t") */
  getDisplayText: (action: string, context: KeybindingContextName) => string | undefined;

  /** All parsed bindings (for help display) */
  bindings: ParsedBinding[];

  /** Current pending chord keystrokes (null if not in a chord) */
  pendingChord: ParsedKeystroke[] | null;

  /** Currently active keybinding contexts (for priority resolution) */
  activeContexts: Set<KeybindingContextName>;

  /** Register a context as active (call on mount) */
  registerActiveContext: (context: KeybindingContextName) => void;

  /** Unregister a context (call on unmount) */
  unregisterActiveContext: (context: KeybindingContextName) => void;

  /** Register a handler for an action (used by useKeybinding) */
  registerHandler: (registration: HandlerRegistration) => () => void;

  /** Invoke all handlers for an action (used by ChordInterceptor) */
  invokeAction: (action: string) => boolean;
};
const KeybindingContext = createContext<KeybindingContextValue | null>(null);
type ProviderProps = {
  bindings: ParsedBinding[];
  /** Ref for immediate access to pending chord (avoids React state delay) */
  pendingChordRef: RefObject<ParsedKeystroke[] | null>;
  /** State value for re-renders (UI updates) */
  pendingChord: ParsedKeystroke[] | null;
  setPendingChord: (pending: ParsedKeystroke[] | null) => void;
  activeContexts: Set<KeybindingContextName>;
  registerActiveContext: (context: KeybindingContextName) => void;
  unregisterActiveContext: (context: KeybindingContextName) => void;
  /** Ref to handler registry (used by ChordInterceptor) */
  handlerRegistryRef: RefObject<Map<string, Set<HandlerRegistration>>>;
  children: React.ReactNode;
};
export function KeybindingProvider({
    bindings,
    pendingChordRef,
    pendingChord,
    setPendingChord,
    activeContexts,
    registerActiveContext,
    unregisterActiveContext,
    handlerRegistryRef,
    children
}: ProviderProps) {
  const t1 = (action, context) => getBindingDisplayText(action, context, bindings);

  const getDisplay = t1;
  const t2 = registration => {
      const registry = handlerRegistryRef.current;
      if (!registry) {
        return _temp;
      }
      if (!registry.has(registration.action)) {
        registry.set(registration.action, new Set());
      }
      registry.get(registration.action).add(registration);
      return () => {
        const handlers = registry.get(registration.action);
        if (handlers) {
          handlers.delete(registration);
          if (handlers.size === 0) {
            registry.delete(registration.action);
          }
        }
      };
    };

  const registerHandler = t2;
  const t3 = action_0 => {
      const registry_0 = handlerRegistryRef.current;
      if (!registry_0) {
        return false;
      }
      const handlers_0 = registry_0.get(action_0);
      if (!handlers_0 || handlers_0.size === 0) {
        return false;
      }
      for (const registration_0 of handlers_0) {
        if (activeContexts.has(registration_0.context)) {
          registration_0.handler();
          return true;
        }
      }
      return false;
    };

  const invokeAction = t3;
  const t4 = (input, key, contexts) => resolveKeyWithChordState(input, key, contexts, bindings, pendingChordRef.current);

  const t5 = {
      resolve: t4,
      setPendingChord,
      getDisplayText: getDisplay,
      bindings,
      pendingChord,
      activeContexts,
      registerActiveContext,
      unregisterActiveContext,
      registerHandler,
      invokeAction
    };

  const value = t5;
  const t6 = <KeybindingContext.Provider value={value}>{children}</KeybindingContext.Provider>;

  return t6;
}
function _temp() {}
export function useKeybindingContext() {
  const ctx = useContext(KeybindingContext);
  if (!ctx) {
    throw new Error("useKeybindingContext must be used within KeybindingProvider");
  }
  return ctx;
}

/**
 * Optional hook that returns undefined outside of KeybindingProvider.
 * Useful for components that may render before provider is available.
 */
export function useOptionalKeybindingContext() {
  return useContext(KeybindingContext);
}

/**
 * Hook to register a keybinding context as active while the component is mounted.
 *
 * When a context is registered, its keybindings take precedence over Global bindings.
 * This allows context-specific bindings (like ThemePicker's ctrl+t) to override
 * global bindings (like the todo toggle) when the context is active.
 *
 * @example
 * ```tsx
 * function ThemePicker() {
 *   useRegisterKeybindingContext('ThemePicker')
 *   // Now ThemePicker's ctrl+t binding takes precedence over Global
 * }
 * ```
 */
export function useRegisterKeybindingContext(context, t0) {
  const isActive = t0 === undefined ? true : t0;
  const keybindingContext = useOptionalKeybindingContext();
  const t1 = () => {
      if (!keybindingContext || !isActive) {
        return;
      }
      keybindingContext.registerActiveContext(context);
      return () => {
        keybindingContext.unregisterActiveContext(context);
      };
    };
  const t2 = [context, keybindingContext, isActive];

  useLayoutEffect(t1, t2);
}

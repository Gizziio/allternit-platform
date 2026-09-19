import React, { createContext, useMemo, useSyncExternalStore } from 'react';
import { getTerminalFocused, getTerminalFocusState, subscribeTerminalFocus, type TerminalFocusState } from '../terminal-focus-state';
export type { TerminalFocusState };
export type TerminalFocusContextProps = {
  readonly isTerminalFocused: boolean;
  readonly terminalFocusState: TerminalFocusState;
};
const TerminalFocusContext = createContext<TerminalFocusContextProps>({
  isTerminalFocused: true,
  terminalFocusState: 'unknown'
});

// eslint-disable-next-line custom-rules/no-top-level-side-effects
TerminalFocusContext.displayName = 'TerminalFocusContext';

// Separate component so App.tsx doesn't re-render on focus changes.
// Children are a stable prop reference, so they don't re-render either —
// only components that consume the context will re-render.
export function TerminalFocusProvider(t0) {
  const {
    children
  } = t0;
  const isTerminalFocused = useSyncExternalStore(subscribeTerminalFocus, getTerminalFocused);
  const terminalFocusState = useSyncExternalStore(subscribeTerminalFocus, getTerminalFocusState);
  const t1 = {
      isTerminalFocused,
      terminalFocusState
    };

  const value = t1;
  const t2 = <TerminalFocusContext.Provider value={value}>{children}</TerminalFocusContext.Provider>;

  return t2;
}
export default TerminalFocusContext;

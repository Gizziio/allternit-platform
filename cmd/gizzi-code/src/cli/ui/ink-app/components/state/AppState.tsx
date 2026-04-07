import { feature } from 'bun:bundle';
import React, {
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from 'react';
import { MailboxProvider } from '../context/mailbox.js';
import { useSettingsChange } from '../hooks/useSettingsChange.js';
import { logForDebugging } from '../utils/debug.js';
import {
  createDisabledBypassPermissionsContext,
  isBypassPermissionsModeDisabled,
} from '../utils/permissions/permissionSetup.js';
import { applySettingsChange } from '../utils/settings/applySettingsChange.js';
import type { SettingSource } from '../utils/settings/constants.js';
import { createStore } from './store.js';

// DCE: voice context is ant-only. External builds get a passthrough.
/* eslint-disable @typescript-eslint/no-require-imports */
const VoiceProvider: (props: {
  children: React.ReactNode;
}) => React.ReactNode = feature('VOICE_MODE')
  ? require('../context/voice.js').VoiceProvider
  : ({ children }) => children;
/* eslint-enable @typescript-eslint/no-require-imports */

import {
  type AppState,
  type AppStateStore,
  getDefaultAppState,
} from './AppStateStore.js';

// TODO: Remove these re-exports once all callers import directly from
// ./AppStateStore.js. Kept for back-compat during migration so .ts callers
// can incrementally move off the .tsx import and stop pulling React.
export {
  type AppState,
  type AppStateStore,
  type CompletionBoundary,
  getDefaultAppState,
  IDLE_SPECULATION_STATE,
  type SpeculationResult,
  type SpeculationState,
} from './AppStateStore.js';

export const AppStoreContext = React.createContext<AppStateStore | null>(null);

type Props = {
  children: React.ReactNode;
  initialState?: AppState;
  onChangeAppState?: (args: { newState: AppState; oldState: AppState }) => void;
};

const HasAppStateContext = React.createContext<boolean>(false);

export function AppStateProvider({
  children,
  initialState,
  onChangeAppState,
}: Props) {
  const hasAppStateContext = useContext(HasAppStateContext);
  if (hasAppStateContext) {
    throw new Error(
      'AppStateProvider can not be nested within another AppStateProvider',
    );
  }

  const [store] = useState(() =>
    createStore(initialState ?? getDefaultAppState(), onChangeAppState),
  );

  useEffect(() => {
    const { toolPermissionContext } = store.getState();
    if (
      toolPermissionContext.isBypassPermissionsModeAvailable &&
      isBypassPermissionsModeDisabled()
    ) {
      logForDebugging(
        'Disabling bypass permissions mode on mount (remote settings loaded before mount)',
      );
      store.setState({
        ...toolPermissionContext,
        ...createDisabledBypassPermissionsContext(),
      });
    }
  }, [store]);

  const onSettingsChange = useEffectEvent((source: SettingSource) => {
    applySettingsChange(source, store.setState);
  });

  useSettingsChange(onSettingsChange);

  return (
    <AppStoreContext.Provider value={store}>
      <HasAppStateContext.Provider value={true}>
        <MailboxProvider>
          <VoiceProvider>{children}</VoiceProvider>
        </MailboxProvider>
      </HasAppStateContext.Provider>
    </AppStoreContext.Provider>
  );
}

/**
 * Internal hook to access the store. Throws if used outside of AppStateProvider.
 */
function useAppStore(): AppStateStore {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new ReferenceError(
      'useAppState/useSetAppState cannot be called outside of an <AppStateProvider />',
    );
  }
  return store;
}

/**
 * Subscribe to a slice of AppState.
 * Components using this hook re-render when the selected slice changes.
 * The selector should be stable (defined outside component or memoized).
 */
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = useAppStore();
  const get = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}

/**
 * Get the setAppState updater without subscribing to any state.
 * Returns a stable reference that never changes -- components using only
 * this hook will never re-render from state changes.
 */
export function useSetAppState() {
  return useAppStore().setState;
}

/**
 * Get the store directly (for passing getState/setState to non-React code).
 */
export function useAppStateStore() {
  return useAppStore();
}

const NOOP_SUBSCRIBE = () => () => {};

/**
 * Safe version of useAppState that returns undefined if called outside of AppStateProvider.
 * Useful for components that may be rendered in contexts where AppStateProvider isn't available.
 */
export function useAppStateMaybeOutsideOfProvider<T>(
  selector: (state: AppState) => T,
): T | undefined {
  const store = useContext(AppStoreContext);
  const get = () => (store ? selector(store.getState()) : undefined);
  return useSyncExternalStore(store ? store.subscribe : NOOP_SUBSCRIBE, get, get);
}

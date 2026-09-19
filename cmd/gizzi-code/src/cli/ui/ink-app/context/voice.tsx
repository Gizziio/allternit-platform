import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { createStore, type Store } from '../state/store';
export type VoiceState = {
  voiceState: 'idle' | 'recording' | 'processing';
  voiceError: string | null;
  voiceInterimTranscript: string;
  voiceAudioLevels: number[];
  voiceWarmingUp: boolean;
};
const DEFAULT_STATE: VoiceState = {
  voiceState: 'idle',
  voiceError: null,
  voiceInterimTranscript: '',
  voiceAudioLevels: [],
  voiceWarmingUp: false
};
type VoiceStore = Store<VoiceState>;
const VoiceContext = createContext<VoiceStore | null>(null);
type Props = {
  children: React.ReactNode;
};
export function VoiceProvider({
    children
}: Props) {
  const [store] = useState(_temp);
  const t1 = <VoiceContext.Provider value={store}>{children}</VoiceContext.Provider>;

  return t1;
}
function _temp() {
  return createStore(DEFAULT_STATE);
}
let fallbackStore: VoiceStore | null = null;
function useVoiceStore() {
  const store = useContext(VoiceContext);
  if (store) return store;
  fallbackStore ??= createStore(DEFAULT_STATE);
  return fallbackStore;
}

/**
 * Subscribe to a slice of voice state. Only re-renders when the selected
 * value changes (compared via Object.is).
 */
export function useVoiceState(selector) {
  const store = useVoiceStore();
  const t0 = () => selector(store.getState());

  const get = t0;
  return useSyncExternalStore(store.subscribe, get, get);
}

/**
 * Get the voice state setter. Stable reference — never causes re-renders.
 * store.setState is synchronous: callers can read getVoiceState() immediately
 * after to observe the new value (VoiceKeybindingHandler relies on this).
 */
export function useSetVoiceState() {
  return useVoiceStore().setState;
}

/**
 * Get a synchronous reader for fresh state inside callbacks. Unlike
 * useVoiceState (which subscribes), this doesn't cause re-renders — use
 * inside event handlers that need to read state set earlier in the same tick.
 */
export function useGetVoiceState() {
  return useVoiceStore().getState;
}

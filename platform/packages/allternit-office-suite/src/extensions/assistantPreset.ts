/**
 * Assistant preset bus: a tiny window-event contract that lets app chrome
 * (ribbon "AI Summarize" / "AI Polish" buttons, context-menu AI actions)
 * submit a prompt to the Allternit Office Agent panel without the chrome
 * knowing how the panel is mounted.
 *
 * Producer: `requestAssistantPreset(appKey, instruction)` — called from the
 * vendored apps' ribbon/context-menu handlers alongside their built-in panel
 * wiring. On hosts with no registered assistant extension nothing listens and
 * the event is a no-op, so standalone behavior is unchanged.
 *
 * Consumer: the Allternit Office Agent panel subscribes and runs any request
 * matching its appKey through the same `run` path as a typed message.
 */
import type { OfficeAppKey } from '../bridge/types';

const PRESET_EVENT = 'allternit:assistant-preset';

export interface AssistantPresetDetail {
  appKey: OfficeAppKey;
  instruction: string;
}

/** Submit an instruction to the Allternit Office Agent panel for `appKey`. */
export function requestAssistantPreset(appKey: OfficeAppKey, instruction: string): void {
  if (typeof window === 'undefined' || !instruction.trim()) return;
  window.dispatchEvent(
    new CustomEvent<AssistantPresetDetail>(PRESET_EVENT, {
      detail: { appKey, instruction },
    }),
  );
}

/** Subscribe to preset requests. Returns an unsubscribe function. */
export function onAssistantPreset(
  handler: (detail: AssistantPresetDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<AssistantPresetDetail>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(PRESET_EVENT, listener);
  return () => window.removeEventListener(PRESET_EVENT, listener);
}

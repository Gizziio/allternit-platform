/**
 * HUD ⇄ app-window handoff.
 *
 * The backend binds a session's event stream to the active client. The HUD is a
 * full renderer with its own connection, so entering HUD mode moves the active
 * conversation there and the main app window stops hearing it directly. Leaving
 * HUD mode is therefore a re-home, not a window close: the app window resumes
 * the session the HUD ended on and reconciles the transcript.
 */

import { useEffect, useRef } from 'react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';

const isHudWindow = (): boolean => typeof window !== 'undefined' && window.location.pathname === '/hud';

/** Session identity the HUD should report and the app window should resume. */
function hudTargetSessionId(): string | null {
  return useChatSessionStore.getState().activeSessionId;
}

function openSessionView(sessionId: string): void {
  window.dispatchEvent(
    new CustomEvent('allternit:open-view', {
      detail: {
        viewType: 'cowork-agent-session',
        context: { sessionId, originView: 'chat' },
      },
    }),
  );
}

/** App-window side: take the session back when the HUD goes away. */
export function useHudHandoff(): void {
  const lastSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // The HUD's own renderer mounts the same wiring; it is the window going
    // away, so it has nothing to re-home.
    if (isHudWindow()) {
      return;
    }

    return window.allternit?.shell?.hud?.onChanged?.((state) => {
      // Track the last session the HUD reported while open.
      if (state.open && state.sessionId) {
        lastSessionIdRef.current = state.sessionId;
        return;
      }

      if (!state.open) {
        const target = state.sessionId ?? lastSessionIdRef.current;
        lastSessionIdRef.current = null;

        if (!target) {
          return;
        }

        const current = hudTargetSessionId();
        if (current === target) {
          // Already on this session — nothing to re-home.
          return;
        }

        // Resume the HUD's session in the main window chat surface.
        useChatSessionStore.getState().setActiveSession(target);
        openSessionView(target);
      }
    });
  }, []);
}

/** HUD side: follow a retarget. Asking for HUD mode from another tab while the
 *  HUD is already up switches the conversation showing in it. The HUD always
 *  renders the active chat session, so we only need to change that identity. */
export function useHudGoto(): void {
  useEffect(() => {
    return window.allternit?.shell?.hud?.onGoto?.((sessionId) => {
      useChatSessionStore.getState().setActiveSession(sessionId);
    });
  }, []);
}

/** HUD side: keep main told which session this window is on. */
export function useReportHudSession(): void {
  const activeSessionId = useChatSessionStore((state) => state.activeSessionId);

  useEffect(() => {
    if (!isHudWindow()) {
      return;
    }

    window.allternit?.shell?.hud?.reportSession?.(activeSessionId);
  }, [activeSessionId]);
}

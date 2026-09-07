import { openFabricSessionWindow } from "@/lib/open-fabric-session-window";

const DASHBOARD_ORIGIN =
  typeof import.meta.env !== "undefined" &&
  (import.meta.env.VITE_FABRIC_SESSION_ORIGIN || import.meta.env.VITE_REMOTE_CONTROL_ORIGIN)
    ? String(import.meta.env.VITE_FABRIC_SESSION_ORIGIN || import.meta.env.VITE_REMOTE_CONTROL_ORIGIN)
    : "https://fabric-session.allternit.com";

/**
 * Open the standalone Fabric Session dashboard in a detached surface.
 *
 * Kept as `openRemoteControlWindow` so existing callers (settings, machines
 * panel, Claude RC is a different path and does not use this helper) keep
 * working. Prefer `openFabricSessionWindow` for new code.
 *
 * @param runtimeId Optional runtime to pre-select on the dashboard.
 */
export function openRemoteControlWindow(runtimeId?: string): void {
  if (window.allternit?.shell?.openFabricSession) {
    void window.allternit.shell.openFabricSession(runtimeId);
    return;
  }
  if (window.allternit?.shell?.openRemoteControl) {
    void window.allternit.shell.openRemoteControl(runtimeId);
    return;
  }

  const url = new URL("/", DASHBOARD_ORIGIN);
  if (runtimeId) {
    url.searchParams.set("runtime", runtimeId);
  }
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

export { openFabricSessionWindow };

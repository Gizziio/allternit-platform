import { FABRIC_SESSION_PWA_ORIGIN } from "@/lib/fabric-session-pwa";

const DASHBOARD_ORIGIN =
  typeof import.meta.env !== "undefined" &&
  (import.meta.env.VITE_FABRIC_SESSION_ORIGIN || import.meta.env.VITE_REMOTE_CONTROL_ORIGIN)
    ? String(import.meta.env.VITE_FABRIC_SESSION_ORIGIN || import.meta.env.VITE_REMOTE_CONTROL_ORIGIN)
    : FABRIC_SESSION_PWA_ORIGIN;

/**
 * Open the standalone Fabric Session dashboard in a detached surface.
 *
 * - Inside the Allternit Desktop shell this opens a dedicated BrowserWindow.
 * - In a normal browser it opens a new tab so the dashboard can be installed as
 *   a PWA on mobile.
 *
 * @param runtimeId Optional runtime to pre-select on the dashboard.
 */
export function openFabricSessionWindow(runtimeId?: string): void {
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

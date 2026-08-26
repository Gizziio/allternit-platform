const DASHBOARD_ORIGIN =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_REMOTE_CONTROL_ORIGIN
    ? String(import.meta.env.VITE_REMOTE_CONTROL_ORIGIN)
    : "https://remotecontrol.allternit.com";

/**
 * Open the standalone Remote Control dashboard in a detached surface.
 *
 * - Inside the Allternit Desktop shell this opens a dedicated BrowserWindow.
 * - In a normal browser it opens a new tab so the dashboard can be installed as
 *   a PWA on mobile.
 *
 * @param runtimeId Optional runtime to pre-select on the dashboard.
 */
export function openRemoteControlWindow(runtimeId?: string): void {
  const url = new URL("/", DASHBOARD_ORIGIN);
  if (runtimeId) {
    url.searchParams.set("runtime", runtimeId);
  }

  if (window.allternit?.shell?.openRemoteControl) {
    void window.allternit.shell.openRemoteControl(runtimeId);
    return;
  }

  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

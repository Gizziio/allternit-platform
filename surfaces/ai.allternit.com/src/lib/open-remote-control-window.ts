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
 */
export function openRemoteControlWindow(): void {
  if (window.allternit?.shell?.openRemoteControl) {
    void window.allternit.shell.openRemoteControl();
    return;
  }

  const url = new URL("/", DASHBOARD_ORIGIN).toString();
  window.open(url, "_blank", "noopener,noreferrer");
}

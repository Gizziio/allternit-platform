/** Open Cloud Console on the Agents tab (Managed Agents analog). Not Hub chat. */

export function openAgentsConsole(sessionId?: string): void {
  window.dispatchEvent(
    new CustomEvent("allternit:open-view", {
      detail: {
        viewType: "cloud-console",
        context: { tab: "agents", sessionId },
      },
    }),
  );
}

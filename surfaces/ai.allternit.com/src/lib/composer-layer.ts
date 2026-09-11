/** Chat (Layer A) vs Cloud Agent session vs Bot Agent. */

export type ComposerLayer = "chat" | "agent" | "bot";

const KEY = "allternit.composer-layer";

export function getComposerLayer(): ComposerLayer {
  if (typeof window === "undefined") return "chat";
  const value = window.sessionStorage.getItem(KEY);
  if (value === "agent" || value === "bot" || value === "chat") return value;
  return "chat";
}

export function setComposerLayer(layer: ComposerLayer): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, layer);
}

export function openAgentsConsole(sessionId?: string): void {
  window.dispatchEvent(
    new CustomEvent("allternit:open-view", {
      detail: {
        viewType: "agent-cloud",
        context: sessionId ? { sessionId } : undefined,
      },
    }),
  );
}

export function openBotHub(): void {
  window.dispatchEvent(
    new CustomEvent("allternit:open-view", {
      detail: { viewType: "agent-hub" },
    }),
  );
}

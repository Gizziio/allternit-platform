/**
 * One noVNC connection per sandbox. Chat pane, Bot Home, ACI, and the
 * detached computer window all host the same desktop — connecting twice
 * to the same ws_url fights for the RFB session. Higher-priority layouts
 * steal the claim; losers show the screenshot poll instead.
 */

export type BotComputerLayout = "page" | "pane" | "aci" | "strip" | "window";

/** Dedicated computer window must keep streaming even if Electron marks the
 *  document hidden (unfocused) or the canvas hasn't intersected yet. */
export function shouldHoldBotDesktopStream(opts: {
  layout: BotComputerLayout;
  pageVisible: boolean;
  isOnscreen: boolean;
}): boolean {
  if (opts.layout === "window") return true;
  return opts.pageVisible && opts.isOnscreen;
}

const PRIORITY: Record<BotComputerLayout, number> = {
  window: 4,
  aci: 3,
  pane: 2,
  page: 1,
  strip: 0,
};

type Owner = { sandboxId: string; layout: BotComputerLayout };

let owner: Owner | null = null;
const listeners = new Set<() => void>();
const tabId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `vnc-${Math.random().toString(36).slice(2)}`;

type OwnerMessage = {
  type: "claim" | "release";
  sandboxId: string;
  layout: BotComputerLayout;
  origin: string;
};

function getOwnerChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel("allternit-vnc-owner");
  } catch {
    return null;
  }
}

const ownerChannel = getOwnerChannel();
ownerChannel?.addEventListener("message", (event: MessageEvent<OwnerMessage>) => {
  const msg = event.data;
  if (!msg || msg.origin === tabId) return;
  if (msg.type === "claim" && owner?.sandboxId === msg.sandboxId) {
    owner = null;
    emit();
  }
});

function emit() {
  for (const listener of listeners) listener();
}

function broadcast(type: OwnerMessage["type"], sandboxId: string, layout: BotComputerLayout) {
  try {
    ownerChannel?.postMessage({ type, sandboxId, layout, origin: tabId } satisfies OwnerMessage);
  } catch {
    // BroadcastChannel is best-effort (jsdom / older runtimes).
  }
}

export function subscribeVncOwner(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVncOwner(): Owner | null {
  return owner;
}

/** True if this layout should hold the live VNC socket. */
export function claimVnc(sandboxId: string, layout: BotComputerLayout): boolean {
  if (!owner || owner.sandboxId !== sandboxId) {
    owner = { sandboxId, layout };
    emit();
    broadcast("claim", sandboxId, layout);
    return true;
  }
  if (owner.layout === layout) return true;
  if (PRIORITY[layout] >= PRIORITY[owner.layout]) {
    owner = { sandboxId, layout };
    emit();
    broadcast("claim", sandboxId, layout);
    return true;
  }
  return false;
}

export function releaseVnc(sandboxId: string, layout: BotComputerLayout): void {
  if (owner?.sandboxId === sandboxId && owner.layout === layout) {
    owner = null;
    emit();
    broadcast("release", sandboxId, layout);
  }
}

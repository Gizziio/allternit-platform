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
/** Claim held in another JS heap (other Electron window / tab) via BroadcastChannel. */
let remoteHolder: Owner | null = null;
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

export function vncEndpointKey(wsUrl: string): string {
  try {
    const url = new URL(wsUrl, "http://local.invalid");
    url.searchParams.delete("token");
    return `${url.pathname}${url.search}`;
  } catch {
    return wsUrl.replace(/([?&])token=[^&]*/g, "$1").replace(/[?&]$/, "");
  }
}

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
  if (msg.type === "claim") {
    noteRemoteClaim(msg.sandboxId, msg.layout);
  } else if (msg.type === "release") {
    noteRemoteRelease(msg.sandboxId);
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

export function getRemoteVncHolder(): Owner | null {
  return remoteHolder;
}

/** Another heap claimed this sandbox. Drop local ownership only if they outrank us. */
export function noteRemoteClaim(sandboxId: string, layout: BotComputerLayout): void {
  const previous = remoteHolder;
  const previousOwner = owner;
  remoteHolder = { sandboxId, layout };
  if (owner?.sandboxId === sandboxId && PRIORITY[owner.layout] < PRIORITY[layout]) {
    owner = null;
  }
  if (
    previous?.sandboxId !== sandboxId ||
    previous?.layout !== layout ||
    previousOwner !== owner
  ) {
    emit();
  }
}

export function noteRemoteRelease(sandboxId: string): void {
  if (remoteHolder?.sandboxId !== sandboxId) return;
  remoteHolder = null;
  emit();
}

function blockedByRemote(sandboxId: string, layout: BotComputerLayout): boolean {
  return Boolean(
    remoteHolder &&
      remoteHolder.sandboxId === sandboxId &&
      PRIORITY[layout] < PRIORITY[remoteHolder.layout],
  );
}

/** True if this layout should hold the live VNC socket. */
export function claimVnc(sandboxId: string, layout: BotComputerLayout): boolean {
  if (blockedByRemote(sandboxId, layout)) return false;
  if (remoteHolder?.sandboxId === sandboxId && PRIORITY[layout] >= PRIORITY[remoteHolder.layout]) {
    remoteHolder = null;
  }
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

/** Test helper — not used in production. */
export function resetVncOwnership(): void {
  owner = null;
  remoteHolder = null;
}

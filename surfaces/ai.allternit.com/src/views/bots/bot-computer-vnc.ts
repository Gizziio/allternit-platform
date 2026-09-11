/**
 * One noVNC connection per sandbox. Chat pane, Bot Home, and ACI all host
 * the same desktop — connecting twice to the same ws_url fights for the
 * RFB session. Higher-priority layouts steal the claim; losers show the
 * screenshot poll instead.
 */

export type BotComputerLayout = "page" | "pane" | "aci" | "strip";

const PRIORITY: Record<BotComputerLayout, number> = {
  aci: 3,
  pane: 2,
  page: 1,
  strip: 0,
};

type Owner = { sandboxId: string; layout: BotComputerLayout };

let owner: Owner | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
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
    return true;
  }
  if (owner.layout === layout) return true;
  if (PRIORITY[layout] >= PRIORITY[owner.layout]) {
    owner = { sandboxId, layout };
    emit();
    return true;
  }
  return false;
}

export function releaseVnc(sandboxId: string, layout: BotComputerLayout): void {
  if (owner?.sandboxId === sandboxId && owner.layout === layout) {
    owner = null;
    emit();
  }
}

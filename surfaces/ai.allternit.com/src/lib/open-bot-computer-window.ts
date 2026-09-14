/**
 * Open a bot's computer in a separate window.
 *
 * In Allternit Desktop this creates a new Electron BrowserWindow (same
 * mechanism as a detached code session). In a regular browser it opens a
 * popup so the desktop is not swallowed into a background tab — never the
 * ACI sidecar pane.
 */

export const BOT_COMPUTER_DETACHED_SURFACE = "bot-computer";

export type BotComputerWindowOptions = {
  botId: string;
  title?: string;
  sandboxId?: string;
};

export function isBotComputerLocation(pathname: string, search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (pathname === "/bot-computer" && Boolean(params.get("botId"))) return true;
  return params.get("detachedSurface") === BOT_COMPUTER_DETACHED_SURFACE && Boolean(params.get("botId"));
}

export function botComputerWindowHref(
  origin: string,
  options: BotComputerWindowOptions,
): string {
  if (!options?.botId) {
    throw new Error("A bot ID is required");
  }
  const url = new URL("/bot-computer", origin);
  url.searchParams.set("botId", options.botId);
  if (options.title) url.searchParams.set("title", options.title);
  if (options.sandboxId) url.searchParams.set("sandboxId", options.sandboxId);
  return url.toString();
}

export function launchBotComputerWindow(options: BotComputerWindowOptions): void {
  if (!options?.botId) {
    console.warn("[launchBotComputerWindow] No bot id provided");
    return;
  }

  const isElectron = Boolean(window.allternit?.shell?.openBotComputer);
  if (isElectron) {
    void window.allternit?.shell
      ?.openBotComputer(options)
      ?.catch((err: unknown) => {
        console.error("[launchBotComputerWindow] Electron bridge failed:", err);
        openDetachedBotComputerPopup(options);
      });
    return;
  }

  openDetachedBotComputerPopup(options);
}

function openDetachedBotComputerPopup(options: BotComputerWindowOptions): void {
  const href = botComputerWindowHref(window.location.origin, options);
  const width = 1280;
  const height = 840;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
    "status=yes",
    "toolbar=no",
    "menubar=no",
    "location=no",
  ].join(",");

  const target = `allternit-bot-computer-${options.botId}`;
  const popup = window.open(href, target, features);
  if (!popup || popup.closed) {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

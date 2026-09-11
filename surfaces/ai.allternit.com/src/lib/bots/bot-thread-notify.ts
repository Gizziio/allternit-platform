/**
 * Per-thread notify mute for long-running bot sessions.
 * Local-only; does not touch push/email.
 *
 * @module bot-thread-notify
 */

const STORAGE_KEY = "allternit.bot-thread-notify";

export type BotThreadNotifyMode = "all" | "mentions" | "muted";

const modes = new Map<string, BotThreadNotifyMode>();
let hydrated = false;

function readStorage(): Record<string, boolean> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const stored = readStorage();
  for (const [id, value] of Object.entries(stored)) {
    if (value === true) modes.set(id, "muted");
    else if (value === false) modes.set(id, "all");
  }
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(`${STORAGE_KEY}.modes`);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, BotThreadNotifyMode>;
    for (const [id, mode] of Object.entries(parsed)) {
      if (mode === "all" || mode === "mentions" || mode === "muted") {
        modes.set(id, mode);
      }
    }
  } catch {
    // ignore
  }
}

function persist(): void {
  const mutedObj: Record<string, boolean> = {};
  const modeObj: Record<string, BotThreadNotifyMode> = {};
  modes.forEach((mode, id) => {
    modeObj[id] = mode;
    if (mode === "muted") mutedObj[id] = true;
  });
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mutedObj));
      localStorage.setItem(`${STORAGE_KEY}.modes`, JSON.stringify(modeObj));
    }
  } catch {
    // private mode / missing storage — in-memory still applies this session
  }
}

export function getBotThreadNotifyMode(
  sessionId: string | null | undefined
): BotThreadNotifyMode {
  if (!sessionId) return "all";
  hydrate();
  return modes.get(sessionId) ?? "all";
}

/** True when this thread should stay quiet. */
export function isBotThreadMuted(sessionId: string | null | undefined): boolean {
  return getBotThreadNotifyMode(sessionId) === "muted";
}

export function setBotThreadMuted(sessionId: string, value: boolean): void {
  setBotThreadNotifyMode(sessionId, value ? "muted" : "all");
}

export function setBotThreadNotifyMode(
  sessionId: string,
  mode: BotThreadNotifyMode
): void {
  hydrate();
  if (mode === "all") modes.delete(sessionId);
  else modes.set(sessionId, mode);
  persist();
}

const NOTIFY_CYCLE: BotThreadNotifyMode[] = ["all", "mentions", "muted"];

export function cycleBotThreadNotifyMode(
  sessionId: string
): BotThreadNotifyMode {
  const current = getBotThreadNotifyMode(sessionId);
  const next = NOTIFY_CYCLE[(NOTIFY_CYCLE.indexOf(current) + 1) % NOTIFY_CYCLE.length];
  setBotThreadNotifyMode(sessionId, next);
  return next;
}

export function notifyModeLabel(mode: BotThreadNotifyMode): string {
  switch (mode) {
    case "mentions":
      return "Mentions only";
    case "muted":
      return "Muted";
    default:
      return "All notifications";
  }
}

/** Test helper. */
export function resetBotThreadNotify(): void {
  modes.clear();
  hydrated = false;
}

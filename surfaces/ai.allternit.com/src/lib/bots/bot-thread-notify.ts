/**
 * Per-thread notify mute for long-running bot sessions.
 * Local-only; does not touch push/email.
 *
 * @module bot-thread-notify
 */

const STORAGE_KEY = "allternit.bot-thread-notify";

const muted = new Map<string, boolean>();
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
    muted.set(id, value === true);
  }
}

function persist(): void {
  const obj: Record<string, boolean> = {};
  muted.forEach((value, id) => {
    if (value) obj[id] = true;
  });
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }
  } catch {
    // private mode / missing storage — in-memory still applies this session
  }
}

/** True when this thread should stay quiet. */
export function isBotThreadMuted(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  hydrate();
  return muted.get(sessionId) === true;
}

export function setBotThreadMuted(sessionId: string, value: boolean): void {
  hydrate();
  if (value) muted.set(sessionId, true);
  else muted.delete(sessionId);
  persist();
}

/** Test helper. */
export function resetBotThreadNotify(): void {
  muted.clear();
  hydrated = false;
}

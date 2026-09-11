/**
 * Long-running bot session helpers: status line, day partitions, and
 * compaction of old stretches so a weeks-old thread stays readable.
 *
 * @module bot-session-chrome
 */

export const COMPACT_AFTER_MS = 48 * 60 * 60 * 1000;

export type BotSessionTone = "idle" | "running" | "waiting" | "error";

export interface BotSessionStatus {
  label: string;
  tone: BotSessionTone;
}

export function botSessionStatus(opts: {
  botName: string;
  isStreaming: boolean;
  sendError?: string | null;
  computerOpen?: boolean;
}): BotSessionStatus {
  if (opts.sendError) {
    return { label: "waiting on you", tone: "error" };
  }
  if (opts.isStreaming) {
    return { label: `${opts.botName} is working`, tone: "running" };
  }
  if (opts.computerOpen) {
    return { label: "computer open", tone: "waiting" };
  }
  return { label: "session open", tone: "idle" };
}

export function messageDayKey(timestamp: string | number | undefined, now = Date.now()): string {
  if (timestamp == null) return "unknown";
  const t = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
  if (Number.isNaN(t)) return "unknown";
  const d = new Date(t);
  const today = new Date(now);
  const startOf = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const deltaDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (deltaDays === 0) return "Today";
  if (deltaDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export interface Timed {
  timestamp?: string | number;
}

export function splitCompactMessages<T extends Timed>(
  messages: T[],
  now = Date.now(),
  compactAfterMs = COMPACT_AFTER_MS
): { older: T[]; recent: T[] } {
  const older: T[] = [];
  const recent: T[] = [];
  for (const message of messages) {
    const raw = message.timestamp;
    const t = typeof raw === "string" ? new Date(raw).getTime() : typeof raw === "number" ? raw : now;
    if (!Number.isNaN(t) && now - t > compactAfterMs) {
      older.push(message);
    } else {
      recent.push(message);
    }
  }
  return { older, recent };
}

export function groupMessagesByDay<T extends Timed>(
  messages: T[],
  now = Date.now()
): Array<{ day: string; messages: T[] }> {
  const groups: Array<{ day: string; messages: T[] }> = [];
  for (const message of messages) {
    const day = messageDayKey(message.timestamp, now);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.messages.push(message);
    } else {
      groups.push({ day, messages: [message] });
    }
  }
  return groups;
}

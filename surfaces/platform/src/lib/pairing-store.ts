/**
 * pairing-store.ts
 *
 * In-memory store for session pairing codes.
 * A pairing code is a short-lived token that maps to a gizzi-code session ID,
 * allowing a mobile device on the same network to join a cowork session.
 *
 * Codes expire after PAIRING_TTL_MS (default 5 minutes).
 */

const PAIRING_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface PairingEntry {
  code: string;
  sessionId: string;
  sessionName?: string;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
}

// Module-level singleton — single process (Next.js local dev)
const store = new Map<string, PairingEntry>();

function generateCode(): string {
  // 6-character alphanumeric code (case-insensitive friendly)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude confusable chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [code, entry] of store.entries()) {
    if (entry.expiresAt < now) {
      store.delete(code);
    }
  }
}

export function createPairingCode(sessionId: string, sessionName?: string): PairingEntry {
  pruneExpired();

  // Also clean up any previous codes for this session
  for (const [code, entry] of store.entries()) {
    if (entry.sessionId === sessionId && !entry.consumed) {
      store.delete(code);
    }
  }

  let code = generateCode();
  // Ensure uniqueness (extremely unlikely collision, but be safe)
  while (store.has(code)) {
    code = generateCode();
  }

  const now = Date.now();
  const entry: PairingEntry = {
    code,
    sessionId,
    sessionName,
    createdAt: now,
    expiresAt: now + PAIRING_TTL_MS,
    consumed: false,
  };
  store.set(code, entry);
  return entry;
}

export function lookupPairingCode(code: string): PairingEntry | null {
  pruneExpired();
  const entry = store.get(code.toUpperCase());
  if (!entry) return null;
  if (entry.consumed) return null;
  return entry;
}

export function consumePairingCode(code: string): PairingEntry | null {
  const entry = lookupPairingCode(code);
  if (!entry) return null;
  entry.consumed = true;
  return entry;
}

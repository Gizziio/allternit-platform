/**
 * CommRails visibility client (Bot Agents BA-1).
 *
 * Read-only DTO from GET /api/commrails/visibility (alias /api/rails/visibility).
 * Fail closed: network/404 → empty arrays and aoRunning=false. Never throw.
 */

import { GATEWAY_BASE_URL } from '@/lib/agents/api-config';
import { isRailsApiEnabled } from '@/lib/env';

export type AoPaneState = 'working' | 'blocked' | 'idle';

export interface VisibilityPane {
  id: string;
  label: string;
  state: AoPaneState;
}

export interface VisibilityNeed {
  id: string;
  label: string;
  reason: string;
}

export interface VisibilityDto {
  panes: VisibilityPane[];
  machines: unknown[];
  fabricDevices: unknown[];
  needsYou: VisibilityNeed[];
  /** False when the fetch failed (ao / rails down). */
  aoRunning: boolean;
}

export const EMPTY_VISIBILITY: VisibilityDto = {
  panes: [],
  machines: [],
  fabricDevices: [],
  needsYou: [],
  aoRunning: false,
};

const SEED_BOT_SESSION_IDS = new Set([
  'bot-session-deep-researcher',
  'bot-session-code-reviewer',
  'bot-session-writing-partner',
]);

const SEED_BOT_IDS = new Set([
  'deep-researcher-001',
  'code-reviewer-001',
  'writing-partner-001',
]);

export function isSeedBotSession(id: string, botId?: string): boolean {
  if (SEED_BOT_SESSION_IDS.has(id)) return true;
  if (botId && SEED_BOT_IDS.has(botId)) return true;
  return false;
}

export function isExecutorThread(threadId: string): boolean {
  return threadId.startsWith('wih:executor-');
}

export function mapAoPaneState(raw: string | undefined): AoPaneState {
  if (raw === 'working' || raw === 'blocked' || raw === 'idle') return raw;
  if (raw === 'active') return 'working';
  return 'idle';
}

export function paneStateToOperational(
  state: AoPaneState,
): 'working' | 'waiting_input' | 'idle' {
  if (state === 'working') return 'working';
  if (state === 'blocked') return 'waiting_input';
  return 'idle';
}

function parseDto(raw: unknown): VisibilityDto {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_VISIBILITY };
  const rec = raw as Record<string, unknown>;
  const panesRaw = Array.isArray(rec.panes) ? rec.panes : [];
  const needsRaw = Array.isArray(rec.needsYou) ? rec.needsYou : [];
  return {
    panes: panesRaw
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .map((p) => ({
        id: String(p.id ?? ''),
        label: String(p.label ?? p.id ?? 'pane'),
        state: mapAoPaneState(typeof p.state === 'string' ? p.state : undefined),
      }))
      .filter((p) => p.id.length > 0),
    machines: Array.isArray(rec.machines) ? rec.machines : [],
    fabricDevices: Array.isArray(rec.fabricDevices) ? rec.fabricDevices : [],
    needsYou: needsRaw
      .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
      .map((n) => ({
        id: String(n.id ?? ''),
        label: String(n.label ?? n.id ?? ''),
        reason: String(n.reason ?? ''),
      }))
      .filter((n) => n.id.length > 0),
    aoRunning: true,
  };
}

async function getJson(
  url: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`visibility ${res.status}`);
  return res.json();
}

export async function fetchVisibility(
  fetchImpl: typeof fetch = fetch,
): Promise<VisibilityDto> {
  if (!isRailsApiEnabled()) return { ...EMPTY_VISIBILITY };
  const base = GATEWAY_BASE_URL.replace(/\/+$/, '');
  const urls = [
    `${base}/api/commrails/visibility`,
    `${base}/api/rails/visibility`,
  ];
  for (const url of urls) {
    try {
      const json = await getJson(url, fetchImpl);
      return parseDto(json);
    } catch {
      continue;
    }
  }
  return { ...EMPTY_VISIBILITY };
}

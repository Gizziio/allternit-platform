/**
 * Native sessions catalog client (read-only subset).
 *
 * Ported from `main` (commit 441ed7495) — the session/ui-session-polish
 * branch predates the native-sessions feature. Only the catalogue reads are
 * vendored here (no pickup/export); the terminal workspace uses this to list
 * harnesses and native CLI sessions and to derive shell spawn commands.
 */

import { buildAuthHeaders } from '@/lib/agents/api-config';
import { getActiveRuntimeId, getRuntimeExecutionTarget } from '@/lib/runtime-target';

function getGatewayOrigin(): string {
  if (typeof window === 'undefined') return '';
  if (getRuntimeExecutionTarget() === 'cloud' && getActiveRuntimeId()) return '';
  const win = window as unknown as Record<string, unknown>;
  const fromWin = typeof win.__ALLTERNIT_GATEWAY_URL__ === 'string' ? (win.__ALLTERNIT_GATEWAY_URL__ as string) : '';
  if (fromWin && !/^https?:\/\/(?:127\.0\.0\.1|localhost)/.test(fromWin)) return fromWin;
  return '';
}

const getBase = () => `${getGatewayOrigin()}/api/v1/native-sessions`;

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await buildAuthHeaders();
  return fetch(url, {
    ...options,
    headers: { ...authHeaders, ...options.headers },
  });
}

export interface NativeHarnessInfo {
  id: string;
  label: string;
  reader: string;
  projectable: boolean;
  /** Template for resuming a session, e.g. "claude --resume <id>". */
  resumeHint: string;
  /** Resolved harness home directory. */
  home: string;
  present: boolean;
}

export interface NativeCatalogSession {
  harness: string;
  sessionId: string;
  path: string;
  cwd?: string;
  title?: string;
  updatedAt: number;
  createdAt?: number;
  fingerprint: string;
  lastEventId?: string;
  installed: boolean;
  reader: string;
  projectable: boolean;
}

export const nativeSessionsApi = {
  async listHarnesses(): Promise<NativeHarnessInfo[]> {
    const res = await authFetch(`${getBase()}/harnesses`);
    if (!res.ok) throw new Error(`native harnesses failed: ${res.status}`);
    const data = (await res.json()) as { harnesses: NativeHarnessInfo[] };
    return data.harnesses ?? [];
  },

  async list(opts: { cwd?: string; harness?: string } = {}): Promise<NativeCatalogSession[]> {
    const params = new URLSearchParams();
    if (opts.cwd) params.set('cwd', opts.cwd);
    if (opts.harness) params.set('harness', opts.harness);
    const qs = params.toString();
    const res = await authFetch(`${getBase()}${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error(`native catalog failed: ${res.status}`);
    const data = (await res.json()) as { sessions: NativeCatalogSession[] };
    return data.sessions ?? [];
  },

  async show(harness: string, id: string, cwd?: string) {
    const params = new URLSearchParams();
    if (cwd) params.set('cwd', cwd);
    const qs = params.toString();
    const res = await authFetch(`${getBase()}/${encodeURIComponent(harness)}/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error(`native show failed: ${res.status}`);
    return res.json();
  },
};

/**
 * Derive a shell launch command for a catalogued native session from the
 * harness resume hint. Hints containing "<id>" get the session id spliced in;
 * hints without a placeholder are bare CLI launches (the harness resumes its
 * most recent session interactively). Returns null when no command exists.
 */
export function deriveSpawnCommand(resumeHint: string | undefined, sessionId: string): string | null {
  const hint = resumeHint?.trim();
  if (!hint) return null;
  if (hint.includes('<id>')) return hint.replace(/<id>/g, sessionId);
  return hint;
}

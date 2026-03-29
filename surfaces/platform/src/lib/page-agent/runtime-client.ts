import { isElectronShell } from '@/lib/platform';

const ELECTRON_PAGE_AGENT_BASE =
  process.env.NEXT_PUBLIC_A2R_THIN_CLIENT_URL ?? 'http://127.0.0.1:3014';

function withBase(path: string): string {
  return `${ELECTRON_PAGE_AGENT_BASE}${path}`;
}

export function getPageAgentRunEndpoint(): string {
  return isElectronShell() ? withBase('/v1/page-agent/run') : '/api/page-agent/run';
}

export function getPageAgentConfigEndpoint(): string {
  return isElectronShell() ? withBase('/v1/page-agent/config') : '/api/page-agent/config';
}

export function getPageAgentStreamEndpoint(sessionId: string): string {
  if (isElectronShell()) {
    return withBase(`/v1/page-agent/stream?sessionId=${encodeURIComponent(sessionId)}`);
  }

  return `/api/page-agent/stream/${sessionId}`;
}

export function getPageAgentStopEndpoint(sessionId?: string | null): string {
  if (isElectronShell()) {
    return withBase('/v1/page-agent/stop');
  }

  return sessionId ? `/api/page-agent/stop/${sessionId}` : '/api/page-agent/stop';
}

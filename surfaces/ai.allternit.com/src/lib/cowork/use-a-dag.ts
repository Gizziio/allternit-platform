/**
 * A:// session-DAG client + react-query hook (cowork rail "A:// run" section).
 *
 * GET /api/v1/cowork/sessions/:id/dag — `:id` may be the cowork session row
 * id or the native (mode-session) chat id; the API resolves both through
 * the session metadata linkage. Fail-closed like use-rails-dags: any error
 * → empty DTO, never throws.
 */

import { useQuery } from '@tanstack/react-query';
import { GATEWAY_BASE_URL } from '@/lib/agents/api-config';

export interface ADagJob {
  id: string;
  job_type: string;
  state: string;
  payload: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ADagEvent {
  event_type: string;
  payload: string;
  initiator: string | null;
  delegator: string | null;
  executor: string | null;
  created_at: string;
}

export interface ADagRun {
  id: string;
  workspace: string;
  initiator: string;
  state: string;
  entrypoint: string;
  created_at: string;
  completed_at: string | null;
}

export interface ADagDto {
  session_id: string;
  intent_id: string;
  run: ADagRun | null;
  jobs: ADagJob[];
  events: ADagEvent[];
}

export const EMPTY_ADAG: ADagDto = {
  session_id: '',
  intent_id: '',
  run: null,
  jobs: [],
  events: [],
};

export const A_DAG_QUERY_KEY = ['cowork-a-dag'] as const;

export async function fetchSessionDag(sessionId: string): Promise<ADagDto> {
  try {
    const res = await fetch(
      `${GATEWAY_BASE_URL}/api/v1/cowork/sessions/${encodeURIComponent(sessionId)}/dag`,
    );
    if (!res.ok) return EMPTY_ADAG;
    const data = (await res.json()) as ADagDto;
    return { ...EMPTY_ADAG, ...data };
  } catch {
    return EMPTY_ADAG;
  }
}

export function useSessionDag(sessionId: string | null) {
  return useQuery({
    queryKey: [...A_DAG_QUERY_KEY, sessionId],
    queryFn: () => fetchSessionDag(sessionId as string),
    enabled: Boolean(sessionId),
    refetchInterval: 4000,
  });
}

import { API_BASE_URL } from '@/lib/agents/api-config';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('startAgentRun');

export interface StartAgentRunOptions {
  agentId: string;
  input: string;
  sessionId?: string;
}

export interface StartAgentRunResult {
  output: string;
  runId?: string;
}

/**
 * Run a single bot turn against the backend agent runtime.
 *
 * This is the packaged-bot equivalent of a chat send: the input is delivered to
 * the agent's run endpoint and the resulting output is returned as a plain
 * string. The caller is responsible for appending both the user input and the
 * assistant output to the bot's session transcript.
 */
export async function startAgentRun(options: StartAgentRunOptions): Promise<StartAgentRunResult> {
  const { agentId, input, sessionId } = options;
  if (!agentId || !input.trim()) {
    throw new Error('agentId and non-empty input are required');
  }

  const url = `${API_BASE_URL}/agents/${encodeURIComponent(agentId)}/runs`;
  const body: Record<string, unknown> = { input: input.trim() };
  if (sessionId) {
    body.session_id = sessionId;
  }

  logger.debug({ agentId, sessionId }, 'Starting agent run');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && ('error' in data || 'message' in data))
        ? String((data as Record<string, unknown>).error ?? (data as Record<string, unknown>).message)
        : `Agent run failed: ${response.status} ${response.statusText}`;
    logger.error({ agentId, status: response.status, message }, 'Agent run request failed');
    throw new Error(message);
  }

  const result = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const output = typeof result.output === 'string' ? result.output : '';
  const runId = typeof result.run_id === 'string' ? result.run_id : undefined;

  logger.debug({ agentId, runId, outputLength: output.length }, 'Agent run completed');

  return { output, runId };
}

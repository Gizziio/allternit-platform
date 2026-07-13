export type ExecutorVendor = 'claude' | 'kimi' | 'codex' | 'agy';
export type ExecutorMode = 'interactive' | 'headless';
export type ExecutorState = 'spawning' | 'running' | 'done' | 'dead' | 'killed';

export interface ExecutorSession {
  sessionId: string;
  slug: string;
  backend: string;
  vendor: ExecutorVendor;
  mode: ExecutorMode;
  state: ExecutorState;
  workdir: string;
  transcriptPath?: string;
  createdAt: string;
  endedAt?: string;
}

export interface VendorProbe {
  vendor: ExecutorVendor;
  binary: string;
  installed: boolean;
  version?: string;
  interactiveSupported: boolean;
  headlessSupported: boolean;
  error?: string;
}

export interface DoctorReport { ok: boolean; checkedAt: string; vendors: VendorProbe[]; }
export interface CompletionReport { status: 'done' | 'blocked'; filesChanged: string[]; deviations: string[]; remaining: string[]; notesPath: string; notesBody: string; }
export interface ReviewResult {
  session: ExecutorSession;
  outcome: { kind: 'done'; report: CompletionReport } | { kind: 'dead'; transcriptPath?: string } | { kind: 'timeout' };
  footprint?: { isolated: boolean; changedFiles: string[]; diffStat?: string };
}

export interface AssignExecutorInput {
  slug: string;
  workdir: string;
  vendor: ExecutorVendor;
  mode: ExecutorMode;
  isolation?: 'worktree' | 'none';
  taskFile?: string;
  notesFile: string;
  prompt?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit = {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  };
  let response = await fetch(`/api/v1/orchestrator${path}`, requestInit);
  // Standalone Gizzi serves /v1 directly; older local stacks may not have the
  // Rust gateway mounted yet. Only a missing route falls back—auth/upstream
  // failures remain visible instead of silently bypassing the gateway.
  if (response.status === 404) response = await fetch(`/v1/orchestrator${path}`, requestInit);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
    throw new Error(body?.message ?? body?.error ?? `Orchestrator API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const getOrchestratorDoctor = () => request<DoctorReport>('/doctor');
export const listExecutorSessions = async () => (await request<{ sessions: ExecutorSession[] }>('/sessions')).sessions;
export const assignExecutor = async (input: AssignExecutorInput) => (await request<{ session: ExecutorSession }>('/assign', { method: 'POST', body: JSON.stringify(input) })).session;
export const getExecutorStatus = (slug: string) => request<{ session: ExecutorSession; state: ExecutorState }>(`/sessions/${encodeURIComponent(slug)}`);
export const tailExecutor = async (slug: string, lines = 80) => (await request<{ output: string }>(`/sessions/${encodeURIComponent(slug)}/tail?lines=${lines}`)).output;
export const sendExecutorMessage = (slug: string, prompt: string) => request<{ submitted: boolean; reason?: string }>(`/sessions/${encodeURIComponent(slug)}/send`, { method: 'POST', body: JSON.stringify({ prompt }) });
export const watchExecutor = (slug: string) => request<ReviewResult>(`/sessions/${encodeURIComponent(slug)}/watch`, { method: 'POST' });
export const killExecutor = (slug: string, removeWorktree = false) => request<{ success: true }>(`/sessions/${encodeURIComponent(slug)}?removeWorktree=${removeWorktree}`, { method: 'DELETE' });

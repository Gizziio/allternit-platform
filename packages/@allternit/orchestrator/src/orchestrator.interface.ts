// packages/@allternit/orchestrator/src/orchestrator.interface.ts
// Vendor-neutral agent orchestration primitives. See ADR-0044.

export type AgentVendor = 'claude' | 'kimi' | 'codex' | 'agy' | (string & {});

export type ExecutorBackendKind = 'local-terminal' | 'local-pty' | 'kernel' | 'cloud' | 'acu';

export type ExecutorMode = 'interactive' | 'headless';

export type SessionState = 'spawning' | 'running' | 'done' | 'dead' | 'killed';

export interface SessionSpec {
  slug: string;
  workdir: string;
  vendor: AgentVendor;
  mode: ExecutorMode;
  /** Full launch command. Build with launchCommand() from vendors.ts unless overriding. */
  launchCommand: string;
  /** 'worktree' isolates the executor in <repo>-ao-<slug> on branch ao/<slug>. */
  isolation?: 'worktree' | 'none';
  /** Task spec path relative to workdir; the orchestrator writes it BEFORE spawning. */
  taskFile?: string;
  /** Completion notes/sentinel path relative to workdir. Its existence is the ONLY completion signal. */
  notesFile: string;
  timeoutMs?: number;
  watchIntervalMs?: number;
}

export interface ExecutorSession {
  /** Backend-scoped id, e.g. tmux session name "ao-<slug>". */
  sessionId: string;
  slug: string;
  backend: ExecutorBackendKind;
  vendor: AgentVendor;
  mode: ExecutorMode;
  state: SessionState;
  /** Effective workdir (the worktree path when isolation === 'worktree'). */
  workdir: string;
  transcriptPath?: string;
  createdAt: string;
  endedAt?: string;
  review?: { status: 'pending' | 'accepted' | 'rejected'; reason?: string; decidedAt?: string };
}

export interface SendResult {
  submitted: boolean;
  /** Populated when submitted === false, e.g. 'verification-mismatch'. */
  reason?: string;
}

/** Parsed YAML frontmatter of the executor's notes file — the completion contract. */
export interface CompletionReport {
  status: 'done' | 'blocked';
  filesChanged: string[];
  deviations: string[];
  remaining: string[];
  notesPath: string;
  /** Prose after the frontmatter. */
  notesBody: string;
}

export type WatchOutcome =
  | { kind: 'done'; report: CompletionReport }
  | { kind: 'dead'; transcriptPath?: string }
  | { kind: 'timeout' };

/** What the executor actually touched — review input, never taken from the notes file. */
export interface Footprint {
  /** True when derived from an isolated worktree diff (authoritative); false = mtime heuristics. */
  isolated: boolean;
  changedFiles: string[];
  diffStat?: string;
  /** Optional terminal evidence captured for caller-owned review. */
  artifacts?: ReviewArtifact[];
}

export interface ReviewArtifact {
  kind: 'terminal-text' | 'terminal-image' | 'terminal-recording';
  path: string;
  sensitive: boolean;
}

export interface HandoffResult {
  session: ExecutorSession;
  outcome: WatchOutcome;
  footprint?: Footprint;
}

export interface ExecutorBackend {
  readonly kind: ExecutorBackendKind;
  spawn(spec: SessionSpec): Promise<ExecutorSession>;
  /** Verified send: paste, read back, submit only on match. Never interrupts the executor. */
  send(session: ExecutorSession, prompt: string): Promise<SendResult>;
  status(session: ExecutorSession): Promise<SessionState>;
  tail(session: ExecutorSession, lines?: number): Promise<string>;
  /** Blocks until the notes sentinel exists, the session dies, or timeout. */
  watch(session: ExecutorSession, spec: SessionSpec): Promise<WatchOutcome>;
  footprint?(session: ExecutorSession): Promise<Footprint>;
  kill(session: ExecutorSession, opts?: { removeWorktree?: boolean }): Promise<void>;
}

export type OrchestrationEventType =
  | 'session.spawned'
  | 'session.prompted'
  | 'session.done'
  | 'session.dead'
  | 'session.timeout'
  | 'session.killed'
  | 'review.pending'
  | 'review.accepted'
  | 'review.rejected';

export interface OrchestrationEvent {
  sessionId: string;
  slug: string;
  eventType: OrchestrationEventType;
  payload?: any;
  timestamp: string;
}

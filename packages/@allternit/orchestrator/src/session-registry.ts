// packages/@allternit/orchestrator/src/session-registry.ts
// Session registry + the three delegation verbs (ADR-0044):
//   handoff     — synchronous: spawn, prompt, block until completion, return report + footprint
//   assign      — asynchronous: spawn (+ optional prompt), return the live session
//   sendMessage — steer or re-task a running session (verified send)
// The review gate is deliberately NOT automated away: handoff returns the
// footprint alongside the executor's own report; acceptance is the caller's act.

import type {
  ExecutorBackend,
  ExecutorSession,
  HandoffResult,
  OrchestrationEvent,
  OrchestrationEventType,
  SendResult,
  SessionSpec,
  SessionState,
} from './orchestrator.interface.js';

interface Entry {
  session: ExecutorSession;
  spec: SessionSpec;
}

export type OrchestrationListener = (event: OrchestrationEvent) => void;

export class SessionRegistry {
  private entries = new Map<string, Entry>();
  private listeners: OrchestrationListener[] = [];

  constructor(private backend: ExecutorBackend) {}

  onEvent(listener: OrchestrationListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(session: ExecutorSession, eventType: OrchestrationEventType, payload?: any): void {
    const event: OrchestrationEvent = {
      sessionId: session.sessionId,
      slug: session.slug,
      eventType,
      payload,
      timestamp: new Date().toISOString(),
    };
    for (const l of this.listeners) l(event);
  }

  async assign(spec: SessionSpec, initialPrompt?: string): Promise<ExecutorSession> {
    if (this.entries.has(spec.slug)) {
      throw new Error(`slug '${spec.slug}' is already registered`);
    }
    const session = await this.backend.spawn(spec);
    this.entries.set(spec.slug, { session, spec });
    this.emit(session, 'session.spawned', { workdir: session.workdir, transcriptPath: session.transcriptPath });

    if (initialPrompt && session.state === 'running') {
      const sent = await this.backend.send(session, initialPrompt);
      if (!sent.submitted) {
        throw new Error(`initial prompt not submitted to ${session.sessionId}: ${sent.reason}`);
      }
      this.emit(session, 'session.prompted', { prompt: initialPrompt });
    }
    return session;
  }

  /** prompt is optional for headless executors whose launch command already carries the task. */
  async handoff(spec: SessionSpec, prompt?: string): Promise<HandoffResult> {
    await this.assign(spec, prompt);
    return this.watch(spec.slug);
  }

  /** Wait for completion and return both executor claims and independently measured footprint. */
  async watch(slug: string): Promise<HandoffResult> {
    const entry = this.mustGet(slug);
    const { session, spec } = entry;
    const outcome = await this.backend.watch(session, spec);

    session.state = outcome.kind === 'done' ? 'done' : outcome.kind === 'dead' ? 'dead' : session.state;
    if (outcome.kind !== 'timeout') session.endedAt = new Date().toISOString();
    this.emit(session, outcome.kind === 'done' ? 'session.done' : outcome.kind === 'dead' ? 'session.dead' : 'session.timeout', outcome);

    let footprint;
    if (this.backend.footprint) {
      footprint = await this.backend.footprint(session).catch(() => undefined);
    }
    if (outcome.kind === 'done') {
      this.emit(session, 'review.pending', { report: outcome.report, footprint });
    }
    return { session, outcome, footprint };
  }

  async sendMessage(slug: string, prompt: string): Promise<SendResult> {
    const entry = this.mustGet(slug);
    const result = await this.backend.send(entry.session, prompt);
    if (result.submitted) this.emit(entry.session, 'session.prompted', { prompt });
    return result;
  }

  async status(slug: string): Promise<SessionState> {
    const entry = this.mustGet(slug);
    const state = await this.backend.status(entry.session);
    if (entry.session.state === 'running') entry.session.state = state;
    return entry.session.state;
  }

  async tail(slug: string, lines?: number): Promise<string> {
    return this.backend.tail(this.mustGet(slug).session, lines);
  }

  list(): ExecutorSession[] {
    return [...this.entries.values()].map((e) => e.session);
  }

  get(slug: string): ExecutorSession | undefined {
    return this.entries.get(slug)?.session;
  }

  async kill(slug: string, opts?: { removeWorktree?: boolean }): Promise<void> {
    const entry = this.mustGet(slug);
    await this.backend.kill(entry.session, opts);
    entry.session.state = 'killed';
    entry.session.endedAt = new Date().toISOString();
    this.emit(entry.session, 'session.killed');
    this.entries.delete(slug);
  }

  private mustGet(slug: string): Entry {
    const entry = this.entries.get(slug);
    if (!entry) throw new Error(`no session registered for slug '${slug}'`);
    return entry;
  }
}

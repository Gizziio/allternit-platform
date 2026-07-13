import type { ExecutorBackend, ExecutorBackendKind, ExecutorSession, Footprint, SendResult, SessionSpec, SessionState, WatchOutcome } from '../orchestrator.interface.js';

export type DelegatedBackendKind = Extract<ExecutorBackendKind, 'kernel' | 'cloud' | 'acu'>;

/** Runtime-specific implementation injected by the owning kernel or service. */
export interface ExecutorBackendDriver {
  spawn(spec: SessionSpec): Promise<ExecutorSession>;
  send(session: ExecutorSession, prompt: string): Promise<SendResult>;
  status(session: ExecutorSession): Promise<SessionState>;
  tail(session: ExecutorSession, lines?: number): Promise<string>;
  watch(session: ExecutorSession, spec: SessionSpec): Promise<WatchOutcome>;
  footprint?(session: ExecutorSession): Promise<Footprint>;
  kill(session: ExecutorSession, opts?: { removeWorktree?: boolean }): Promise<void>;
}

export class DelegatedExecutorBackend implements ExecutorBackend {
  constructor(readonly kind: DelegatedBackendKind, private driver?: ExecutorBackendDriver) {}

  available(): { available: boolean; reason?: string } {
    return this.driver ? { available: true } : { available: false, reason: `${this.kind} executor driver is not configured` };
  }

  attach(driver: ExecutorBackendDriver): void {
    this.driver = driver;
  }

  private required(): ExecutorBackendDriver {
    if (!this.driver) throw new Error(`${this.kind} executor backend is unavailable: no runtime driver configured`);
    return this.driver;
  }

  async spawn(spec: SessionSpec): Promise<ExecutorSession> {
    const session = await this.required().spawn(spec);
    return { ...session, backend: this.kind };
  }

  send(session: ExecutorSession, prompt: string): Promise<SendResult> {
    return this.required().send(session, prompt);
  }

  status(session: ExecutorSession): Promise<SessionState> {
    return this.required().status(session);
  }

  tail(session: ExecutorSession, lines?: number): Promise<string> {
    return this.required().tail(session, lines);
  }

  watch(session: ExecutorSession, spec: SessionSpec): Promise<WatchOutcome> {
    return this.required().watch(session, spec);
  }

  footprint(session: ExecutorSession): Promise<Footprint> {
    const driver = this.required();
    if (!driver.footprint) throw new Error(`${this.kind} executor driver does not provide review footprints`);
    return driver.footprint(session);
  }

  kill(session: ExecutorSession, opts?: { removeWorktree?: boolean }): Promise<void> {
    return this.required().kill(session, opts);
  }
}

export class KernelExecutorBackend extends DelegatedExecutorBackend {
  constructor(driver?: ExecutorBackendDriver) { super('kernel', driver); }
}

export class CloudExecutorBackend extends DelegatedExecutorBackend {
  constructor(driver?: ExecutorBackendDriver) { super('cloud', driver); }
}

export class AcuExecutorBackend extends DelegatedExecutorBackend {
  constructor(driver?: ExecutorBackendDriver) { super('acu', driver); }
}

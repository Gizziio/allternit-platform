import {
  ActionIntentSchema,
  ApprovalRequestSchema,
  BrowserEventSchema,
  BrowserRunSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  ExecutionLeaseSchema,
  PolicyDecisionSchema,
  ReceiptSchema,
  SessionSpecSchema,
  type ActionIntent,
  type ApprovalRequest,
  type BrowserEvent,
  type BrowserProvider,
  type BrowserRun,
  type BrowserTrajectory,
  type ExecutionLease,
  type PolicyDecision,
  type ProviderKind,
  type Receipt,
  type SessionSpec,
  type Surface,
} from '@allternit/computer-use-protocol';

export interface BrowserRunControllerOptions {
  providers: BrowserProvider[];
  sourceSurface?: Surface;
  policy?: (action: ActionIntent) => Promise<PolicyDecision> | PolicyDecision;
  now?: () => Date;
}

export interface StartBrowserRunInput {
  accountId: string;
  conversationId: string;
  objective: string;
  provider: ProviderKind;
  startedBy: Surface;
  sessionId?: string;
  runId?: string;
  deviceId?: string;
}

export interface ExecuteBrowserActionInput {
  lease: ExecutionLease;
  action: ActionIntent;
}

export interface ExecuteBrowserActionResult {
  run: BrowserRun;
  events: BrowserEvent[];
  approval?: ApprovalRequest;
  receipt?: Receipt;
}

export class BrowserRunController {
  private readonly providers = new Map<ProviderKind, BrowserProvider>();
  private readonly sessions = new Map<string, SessionSpec>();
  private readonly runs = new Map<string, BrowserRun>();
  private readonly leases = new Map<string, ExecutionLease>();
  private readonly events = new Map<string, BrowserEvent[]>();
  private readonly actions = new Map<string, ActionIntent[]>();
  private readonly receipts = new Map<string, Receipt[]>();
  private readonly policy: NonNullable<BrowserRunControllerOptions['policy']>;
  private readonly sourceSurface?: Surface;
  private readonly now: () => Date;

  constructor(options: BrowserRunControllerOptions) {
    for (const provider of options.providers) {
      this.providers.set(provider.capabilities.provider, provider);
    }
    this.policy = options.policy ?? (() => ({
      decision: 'allow',
      policyId: 'default-allow',
      reason: 'No browser policy hook configured',
      risk: 'low',
    }));
    this.sourceSurface = options.sourceSurface;
    this.now = options.now ?? (() => new Date());
  }

  getProvider(provider: ProviderKind): BrowserProvider {
    const resolved = this.providers.get(provider);
    if (!resolved) throw new Error(`Browser provider is not registered: ${provider}`);
    return resolved;
  }

  listProviders(): BrowserProvider[] {
    return [...this.providers.values()];
  }

  startRun(input: StartBrowserRunInput): { run: BrowserRun; session: SessionSpec; lease: ExecutionLease; events: BrowserEvent[] } {
    this.getProvider(input.provider);
    const createdAt = this.nowIso();
    const session = SessionSpecSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      sessionId: input.sessionId ?? crypto.randomUUID(),
      accountId: input.accountId,
      conversationId: input.conversationId,
      createdBySurface: input.startedBy,
      provider: input.provider,
      deviceId: input.deviceId,
      createdAt,
    });
    const run = BrowserRunSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      runId: input.runId ?? crypto.randomUUID(),
      conversationId: input.conversationId,
      accountId: input.accountId,
      sessionId: session.sessionId,
      objective: input.objective,
      state: 'running',
      startedBy: input.startedBy,
      provider: input.provider,
      createdAt,
      updatedAt: createdAt,
      lastSequence: 0,
    });
    const lease = this.issueLease(run.runId, input.startedBy);
    this.sessions.set(session.sessionId, session);
    this.runs.set(run.runId, run);
    this.leases.set(run.runId, lease);
    const event = this.appendEvent(run.runId, run.sessionId, 'run.started', {
      objective: run.objective,
      provider: run.provider,
      leaseId: lease.leaseId,
    });
    return { run: this.requireRun(run.runId), session, lease, events: [event] };
  }

  async observe(runId: string): Promise<ExecuteBrowserActionResult> {
    const run = this.requireRun(runId);
    const provider = this.getProvider(run.provider);
    const observation = await provider.observe(run.sessionId);
    const event = this.appendEvent(run.runId, run.sessionId, 'observation.created', { observation });
    return { run: this.requireRun(runId), events: [event] };
  }

  async execute(input: ExecuteBrowserActionInput): Promise<ExecuteBrowserActionResult> {
    const lease = ExecutionLeaseSchema.parse(input.lease);
    const action = ActionIntentSchema.parse(input.action);
    const run = this.requireRun(action.runId);
    this.actions.set(run.runId, [...(this.actions.get(run.runId) ?? []), action]);
    this.assertRunCanExecute(run);
    this.assertLease(run, lease);
    if (action.sessionId !== run.sessionId) {
      throw new Error(`Action ${action.actionId} targets session ${action.sessionId}, expected ${run.sessionId}`);
    }

    const decision = PolicyDecisionSchema.parse(await this.policy(action));
    const policyEvent = this.appendEvent(run.runId, run.sessionId, 'action.state_changed', {
      actionId: action.actionId,
      state: 'policy_checked',
      policy: decision,
    });
    if (decision.decision === 'deny') {
      const receipt = this.issueReceipt(run, action, 'denied');
      this.recordReceipt(run.runId, receipt);
      this.transitionRun(run.runId, 'failed');
      const receiptEvent = this.appendEvent(run.runId, run.sessionId, 'receipt.issued', { receipt });
      return { run: this.requireRun(run.runId), events: [policyEvent, receiptEvent], receipt };
    }
    if (decision.decision === 'require_approval') {
      const approval = ApprovalRequestSchema.parse({
        approvalId: crypto.randomUUID(),
        runId: run.runId,
        actionId: action.actionId,
        requestedAt: this.nowIso(),
        summary: action.reason,
        sideEffect: action.targetDescription ?? action.kind,
        risk: decision.risk,
      });
      this.transitionRun(run.runId, 'approval_pending');
      const approvalEvent = this.appendEvent(run.runId, run.sessionId, 'approval.required', { approval, policy: decision });
      return { run: this.requireRun(run.runId), events: [policyEvent, approvalEvent], approval };
    }

    const provider = this.getProvider(run.provider);
    const providerEvents = await provider.execute(action);
    const acceptedProviderEvents = providerEvents.map((event) => this.appendProviderEvent(run, event));
    const failed = acceptedProviderEvents.some((event) => (
      event.type === 'action.state_changed'
      && event.payload.actionId === action.actionId
      && event.payload.state === 'failed'
    ));
    const receipt = this.issueReceipt(run, action, failed ? 'failed' : 'committed');
    this.recordReceipt(run.runId, receipt);
    const receiptEvent = this.appendEvent(run.runId, run.sessionId, 'receipt.issued', { receipt });
    return { run: this.requireRun(run.runId), events: [policyEvent, ...acceptedProviderEvents, receiptEvent], receipt };
  }

  completeRun(runId: string): { run: BrowserRun; events: BrowserEvent[] } {
    const run = this.transitionRun(runId, 'completed');
    const event = this.appendEvent(run.runId, run.sessionId, 'run.completed', {});
    return { run: this.requireRun(runId), events: [event] };
  }

  cancelRun(runId: string, reason: string): { run: BrowserRun; events: BrowserEvent[] } {
    const run = this.transitionRun(runId, 'cancelled');
    const event = this.appendEvent(run.runId, run.sessionId, 'run.cancelled', { reason });
    return { run: this.requireRun(runId), events: [event] };
  }

  eventsAfter(runId: string, afterSequence = 0): BrowserEvent[] {
    return (this.events.get(runId) ?? []).filter((event) => event.sequence > afterSequence);
  }

  getRun(runId: string): BrowserRun | undefined {
    return this.runs.get(runId);
  }

  getLease(runId: string): ExecutionLease | undefined {
    return this.leases.get(runId);
  }

  getSession(sessionId: string): SessionSpec | undefined {
    return this.sessions.get(sessionId);
  }

  toTrajectory(runId: string): BrowserTrajectory {
    const run = this.requireRun(runId);
    const actions = this.actions.get(runId) ?? [];
    const receipts = this.receipts.get(runId) ?? [];
    return {
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      trajectoryId: `trajectory_${run.runId}`,
      runId: run.runId,
      sessionId: run.sessionId,
      objective: run.objective,
      createdAt: run.createdAt,
      provider: run.provider,
      steps: actions.map((action, index) => {
        const receipt = receipts.find((candidate) => candidate.actionId === action.actionId);
        return {
          stepId: `step_${index + 1}`,
          action,
          receiptId: receipt?.receiptId,
          status: receipt?.outcome === 'committed' ? 'committed' : receipt?.outcome === 'failed' ? 'failed' : 'skipped',
        };
      }),
      observations: [],
      receipts,
    };
  }

  private appendProviderEvent(run: BrowserRun, event: BrowserEvent): BrowserEvent {
    if (event.runId !== run.runId || event.sessionId !== run.sessionId) {
      throw new Error(`Provider emitted event for the wrong run or session: ${event.eventId}`);
    }
    return this.appendEvent(run.runId, run.sessionId, event.type, event.payload);
  }

  private issueLease(runId: string, ownerSurface: Surface): ExecutionLease {
    const issuedAt = this.now();
    return ExecutionLeaseSchema.parse({
      leaseId: crypto.randomUUID(),
      runId,
      ownerSurfaceInstanceId: `${ownerSurface}:${crypto.randomUUID()}`,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 5 * 60_000).toISOString(),
      epoch: 1,
      nonce: crypto.randomUUID().replace(/-/g, ''),
    });
  }

  private issueReceipt(run: BrowserRun, action: ActionIntent, outcome: Receipt['outcome']): Receipt {
    return ReceiptSchema.parse({
      receiptId: crypto.randomUUID(),
      runId: run.runId,
      actionId: action.actionId,
      outcome,
      issuedAt: this.nowIso(),
    });
  }

  private recordReceipt(runId: string, receipt: Receipt): void {
    this.receipts.set(runId, [...(this.receipts.get(runId) ?? []), receipt]);
  }

  private assertRunCanExecute(run: BrowserRun): void {
    if (run.state !== 'running' && run.state !== 'recovering') {
      throw new Error(`Run ${run.runId} is not executable while ${run.state}`);
    }
  }

  private assertLease(run: BrowserRun, lease: ExecutionLease): void {
    const active = this.leases.get(run.runId);
    if (!active || active.leaseId !== lease.leaseId || active.epoch !== lease.epoch) {
      throw new Error(`Lease ${lease.leaseId} is not active for run ${run.runId}`);
    }
    if (new Date(lease.expiresAt).getTime() <= this.now().getTime()) {
      throw new Error(`Lease ${lease.leaseId} has expired`);
    }
  }

  private transitionRun(runId: string, state: BrowserRun['state']): BrowserRun {
    const run = this.requireRun(runId);
    const updated = BrowserRunSchema.parse({ ...run, state, updatedAt: this.nowIso() });
    this.runs.set(runId, updated);
    return updated;
  }

  private appendEvent(runId: string, sessionId: string, type: BrowserEvent['type'], payload: Record<string, unknown>): BrowserEvent {
    const run = this.requireRun(runId);
    const sequence = run.lastSequence + 1;
    const event = BrowserEventSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      eventId: crypto.randomUUID(),
      runId,
      sessionId,
      sequence,
      emittedAt: this.nowIso(),
      sourceSurface: this.sourceSurface,
      type,
      payload,
    });
    const updated = BrowserRunSchema.parse({ ...run, lastSequence: sequence, updatedAt: event.emittedAt });
    this.runs.set(runId, updated);
    this.events.set(runId, [...(this.events.get(runId) ?? []), event]);
    return event;
  }

  private requireRun(runId: string): BrowserRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown browser run: ${runId}`);
    return run;
  }

  private nowIso(): string {
    return this.now().toISOString();
  }
}

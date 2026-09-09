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
  SiteToolCallSchema,
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
  type SiteToolCall,
  type Surface,
} from '@allternit/computer-use-protocol';
import { SiteToolRegistry, originMatches, type SiteToolContext } from '../browser/site-tools/registry.js';
import { planResolution, type ResolutionPlan } from '../browser/site-tools/resolver.js';

export interface BrowserRunControllerOptions {
  providers: BrowserProvider[];
  sourceSurface?: Surface;
  policy?: (action: ActionIntent) => Promise<PolicyDecision> | PolicyDecision;
  siteTools?: SiteToolRegistry;
  /** Maps a run to the CDP binding site tool handlers drive their browser primitives through. */
  resolveToolContext?: (run: BrowserRun) => SiteToolContext;
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

export interface ExecuteSiteToolInput {
  lease: ExecutionLease;
  toolName: string;
  args?: Record<string, unknown>;
}

export interface ExecuteSiteToolResult {
  run: BrowserRun;
  events: BrowserEvent[];
  toolCall: SiteToolCall;
}

type StepLogEntry = { kind: 'action'; actionId: string } | { kind: 'tool_call'; toolCallId: string };

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
  private readonly siteTools?: SiteToolRegistry;
  private readonly resolveToolContext?: (run: BrowserRun) => SiteToolContext;
  private readonly lastOrigins = new Map<string, string>();
  private readonly stepLog = new Map<string, StepLogEntry[]>();
  private readonly toolCalls = new Map<string, SiteToolCall[]>();
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
    this.siteTools = options.siteTools;
    this.resolveToolContext = options.resolveToolContext;
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
    this.lastOrigins.set(run.runId, observation.url);
    const event = this.appendEvent(run.runId, run.sessionId, 'observation.created', { observation });
    return { run: this.requireRun(runId), events: [event] };
  }

  /**
   * Site tools available for the run's active tab origin, plus the resolver
   * preference order. Surfaced to the model before falling back to ref-based
   * (DOM refs) and then vision actions.
   */
  availableTools(runId: string): ResolutionPlan {
    if (!this.siteTools) return { order: ['dom-refs', 'vision'], tools: [] };
    return planResolution(this.siteTools.list(), this.lastOrigins.get(runId) ?? null);
  }

  async execute(input: ExecuteBrowserActionInput): Promise<ExecuteBrowserActionResult> {
    const lease = ExecutionLeaseSchema.parse(input.lease);
    const action = ActionIntentSchema.parse(input.action);
    const run = this.requireRun(action.runId);
    this.actions.set(run.runId, [...(this.actions.get(run.runId) ?? []), action]);
    this.logStep(run.runId, { kind: 'action', actionId: action.actionId });
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

  /**
   * Invoke a registered site tool for a run. The tool boundary (registry)
   * enforces the plugin's blockedActions — a blocked call is refused and
   * logged, never attempted. Every invocation is recorded as a SiteToolCall
   * and emitted on the run's event stream as 'tool.called'.
   */
  async executeTool(input: ExecuteSiteToolInput): Promise<ExecuteSiteToolResult> {
    if (!this.siteTools) throw new Error('No site tool registry configured on this controller');
    const lease = ExecutionLeaseSchema.parse(input.lease);
    const run = this.requireRun(lease.runId);
    this.assertRunCanExecute(run);
    this.assertLease(run, lease);

    const tool = this.siteTools.get(input.toolName);
    if (!tool) {
      throw new Error(`Unknown site tool: ${input.toolName}`);
    }
    const origin = this.lastOrigins.get(run.runId) ?? null;
    if (origin && !originMatches(origin, tool.allowedDomains)) {
      throw new Error(
        `Site tool ${input.toolName} is not allowed for origin ${origin}; allowed domains: ${tool.allowedDomains.join(', ')}`,
      );
    }

    const binding = this.resolveToolContext ? this.resolveToolContext(run) : undefined;
    if (!binding) {
      throw new Error(`No site tool context resolver configured for run ${run.runId}`);
    }
    const startedAt = Date.now();
    let result = { ok: true as boolean, summary: '' as string | undefined, error: undefined as string | undefined };
    try {
      const outcome = await this.siteTools.invoke(input.toolName, input.args ?? {}, binding);
      result = {
        ok: outcome.ok,
        summary: outcome.summary,
        error: outcome.ok ? undefined : (outcome.reason ?? outcome.summary),
      };
    } catch (error) {
      result = {
        ok: false,
        summary: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    const latencyMs = Date.now() - startedAt;

    const toolCall = SiteToolCallSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      toolCallId: crypto.randomUUID(),
      runId: run.runId,
      sessionId: run.sessionId,
      toolName: input.toolName,
      args: input.args ?? {},
      resultSummary: result.summary,
      latencyMs,
      error: result.error,
      redacted: false,
      invokedAt: this.nowIso(),
    });
    this.toolCalls.set(run.runId, [...(this.toolCalls.get(run.runId) ?? []), toolCall]);
    this.logStep(run.runId, { kind: 'tool_call', toolCallId: toolCall.toolCallId });
    const event = this.appendEvent(run.runId, run.sessionId, 'tool.called', { toolCall });
    return { run: this.requireRun(run.runId), events: [event], toolCall };
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

  /**
   * Record a session artifact (e.g. a finalized video) on the run's event
   * stream as 'artifact.created'. The payload is free-form; video artifacts
   * carry { kind: 'video', path, startedAtEpoch, sizeBytes }.
   */
  recordArtifact(runId: string, artifact: Record<string, unknown>): BrowserEvent {
    const run = this.requireRun(runId);
    return this.appendEvent(run.runId, run.sessionId, 'artifact.created', { artifact });
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
    const toolCalls = this.toolCalls.get(runId) ?? [];
    const log = this.stepLog.get(runId) ?? [];
    const steps: BrowserTrajectory['steps'] = log.map((entry, index) => {
      if (entry.kind === 'tool_call') {
        const toolCall = toolCalls.find((candidate) => candidate.toolCallId === entry.toolCallId);
        if (!toolCall) throw new Error(`Step log references unknown tool call ${entry.toolCallId}`);
        return {
          kind: 'tool_call' as const,
          stepId: `step_${index + 1}`,
          toolCall,
          status: toolCall.error ? 'failed' as const : 'committed' as const,
        };
      }
      const action = actions.find((candidate) => candidate.actionId === entry.actionId);
      if (!action) throw new Error(`Step log references unknown action ${entry.actionId}`);
      const receipt = receipts.find((candidate) => candidate.actionId === action.actionId);
      return {
        kind: 'action' as const,
        stepId: `step_${index + 1}`,
        action,
        receiptId: receipt?.receiptId,
        status: receipt?.outcome === 'committed' ? 'committed' as const : receipt?.outcome === 'failed' ? 'failed' as const : 'skipped' as const,
      };
    });
    return {
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      trajectoryId: `trajectory_${run.runId}`,
      runId: run.runId,
      sessionId: run.sessionId,
      objective: run.objective,
      createdAt: run.createdAt,
      provider: run.provider,
      steps,
      observations: [],
      receipts,
    };
  }

  private logStep(runId: string, entry: StepLogEntry): void {
    this.stepLog.set(runId, [...(this.stepLog.get(runId) ?? []), entry]);
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

import { z } from "zod";

export const COMPUTER_USE_PROTOCOL_VERSION = "1.0" as const;

export const SurfaceSchema = z.enum([
  "platform-web",
  "desktop",
  "gizzi",
  "extension",
  "api",
]);

export const ProviderKindSchema = z.enum([
  "local-playwright",
  "extension-tab",
  "browser-use",
  "stagehand",
]);

export const CapabilitySchema = z.enum([
  "navigate",
  "observe.dom",
  "observe.accessibility",
  "observe.screenshot",
  "interact.pointer",
  "interact.keyboard",
  "tabs",
  "frames",
  "dialogs",
  "files.upload",
  "files.download",
  "network.inspect",
  "console.inspect",
  "record",
  "replay",
]);

export const ProviderCapabilitiesSchema = z.object({
  provider: ProviderKindSchema,
  capabilities: z.array(CapabilitySchema),
  local: z.boolean(),
  attachedToUserSession: z.boolean(),
  supportsPrivateNetwork: z.boolean(),
  supportsPersistentProfile: z.boolean(),
  limits: z
    .object({
      maxTabs: z.number().int().positive().optional(),
      maxObservationChars: z.number().int().positive().optional(),
      maxRunMs: z.number().int().positive().optional(),
    })
    .optional(),
});

export const SessionSpecSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  sessionId: z.string().min(1),
  accountId: z.string().min(1),
  conversationId: z.string().min(1),
  createdBySurface: SurfaceSchema,
  provider: ProviderKindSchema,
  deviceId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
});

export const DeviceTrustSchema = z.enum(["unpaired", "pending", "trusted", "revoked"]);

export const PairedDeviceSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  deviceId: z.string().min(1),
  accountId: z.string().min(1),
  displayName: z.string().min(1),
  surfaces: z.array(SurfaceSchema).min(1),
  trust: DeviceTrustSchema,
  publicKeyThumbprint: z.string().min(16),
  pairedAt: z.string().datetime().optional(),
  lastSeenAt: z.string().datetime().optional(),
});

export const SurfacePresenceSchema = z.object({
  surfaceInstanceId: z.string().min(1),
  surface: SurfaceSchema,
  accountId: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  status: z.enum(["online", "away", "offline"]),
  capabilities: z.array(CapabilitySchema).default([]),
  observedAt: z.string().datetime(),
});

export const RunStateSchema = z.enum([
  "queued", "running", "approval_pending", "paused", "recovering",
  "completed", "failed", "cancelled",
]);

export const BrowserRunSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  runId: z.string().min(1),
  conversationId: z.string().min(1),
  accountId: z.string().min(1),
  sessionId: z.string().min(1),
  objective: z.string().min(1),
  state: RunStateSchema,
  startedBy: SurfaceSchema,
  provider: ProviderKindSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSequence: z.number().int().nonnegative().default(0),
});

export const ExecutionLeaseSchema = z.object({
  leaseId: z.string().min(1),
  runId: z.string().min(1),
  ownerSurfaceInstanceId: z.string().min(1),
  ownerDeviceId: z.string().min(1).optional(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  epoch: z.number().int().positive(),
  nonce: z.string().min(16),
});

export const HandoffRequestSchema = z.object({
  handoffId: z.string().min(1),
  runId: z.string().min(1),
  fromSurfaceInstanceId: z.string().min(1),
  toSurfaceInstanceId: z.string().min(1),
  requestedAt: z.string().datetime(),
  lastAcknowledgedSequence: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
});

export const ResumeCursorSchema = z.object({
  runId: z.string().min(1),
  surfaceInstanceId: z.string().min(1),
  afterSequence: z.number().int().nonnegative(),
  leaseEpoch: z.number().int().positive().optional(),
});

export const ObservationRefSchema = z.object({
  ref: z.string().min(1),
  role: z.string().min(1),
  name: z.string(),
  selector: z.string().min(1).optional(),
  frameId: z.string().min(1).optional(),
  disabled: z.boolean().optional(),
});

export const ArtifactRefSchema = z.object({
  artifactId: z.string().min(1),
  kind: z.enum(["screenshot", "download", "upload", "trace", "recording", "receipt"]),
  mediaType: z.string().min(1),
  uri: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  redacted: z.boolean().default(false),
});

export const BrowserObservationSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  observationId: z.string().min(1),
  sessionId: z.string().min(1),
  url: z.string().url(),
  title: z.string(),
  capturedAt: z.string().datetime(),
  format: z.enum(["accessibility", "dom", "screenshot", "hybrid"]),
  text: z.string().optional(),
  refs: z.array(ObservationRefSchema).default([]),
  artifacts: z.array(ArtifactRefSchema).default([]),
  truncated: z.boolean().default(false),
  redactions: z.array(z.string()).default([]),
});

export const ActionKindSchema = z.enum([
  "navigate",
  "click",
  "type",
  "press",
  "scroll",
  "select",
  "hover",
  "wait",
  "tab.open",
  "tab.focus",
  "tab.close",
  "dialog.accept",
  "dialog.dismiss",
  "file.upload",
  "download",
  "extract",
  "screenshot",
]);

export const ActionIntentSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  actionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  kind: ActionKindSchema,
  reason: z.string().min(1),
  targetRef: z.string().min(1).optional(),
  targetDescription: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().min(1).optional(),
});

export const ActionStateSchema = z.enum([
  "planned",
  "resolved",
  "policy_checked",
  "approval_pending",
  "executing",
  "observed",
  "verified",
  "committed",
  "recovering",
  "failed",
]);

export const PolicyDecisionSchema = z.object({
  decision: z.enum(["allow", "deny", "require_approval"]),
  policyId: z.string().min(1),
  reason: z.string().min(1),
  risk: z.enum(["low", "medium", "high", "critical"]),
});

export const ApprovalRequestSchema = z.object({
  approvalId: z.string().min(1),
  runId: z.string().min(1),
  actionId: z.string().min(1),
  requestedAt: z.string().datetime(),
  summary: z.string().min(1),
  sideEffect: z.string().min(1),
  risk: z.enum(["low", "medium", "high", "critical"]),
  expiresAt: z.string().datetime().optional(),
});

export const ReceiptSchema = z.object({
  receiptId: z.string().min(1),
  runId: z.string().min(1),
  actionId: z.string().min(1).optional(),
  previousReceiptId: z.string().min(1).optional(),
  outcome: z.enum(["committed", "denied", "failed", "cancelled"]),
  evidence: z.array(ArtifactRefSchema).default([]),
  issuedAt: z.string().datetime(),
});

export const BrowserEventSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  eventId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  emittedAt: z.string().datetime(),
  sourceSurface: SurfaceSchema.optional(),
  type: z.enum([
    "run.started",
    "run.paused",
    "run.resumed",
    "run.completed",
    "run.failed",
    "run.cancelled",
    "action.state_changed",
    "observation.created",
    "approval.required",
    "approval.resolved",
    "artifact.created",
    "receipt.issued",
    "handoff.requested",
    "handoff.completed",
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const BrowserTrajectoryStepSchema = z.object({
  stepId: z.string().min(1),
  action: ActionIntentSchema,
  observationId: z.string().min(1).optional(),
  receiptId: z.string().min(1).optional(),
  status: z.enum(["committed", "failed", "skipped"]),
  note: z.string().optional(),
});

export const BrowserTrajectorySchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  trajectoryId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  objective: z.string().min(1),
  createdAt: z.string().datetime(),
  provider: ProviderKindSchema,
  steps: z.array(BrowserTrajectoryStepSchema),
  observations: z.array(BrowserObservationSchema).default([]),
  receipts: z.array(ReceiptSchema).default([]),
});

export const BrowserWorkflowInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
});

export const BrowserWorkflowStepSchema = z.object({
  id: z.string().min(1),
  kind: ActionKindSchema,
  target: z
    .object({
      ref: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
    })
    .optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().min(1),
});

export const BrowserWorkflowSpecSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  workflowId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  sourceRunId: z.string().min(1),
  provider: ProviderKindSchema,
  inputs: z.array(BrowserWorkflowInputSchema).default([]),
  steps: z.array(BrowserWorkflowStepSchema).min(1),
  safety: z.object({
    requiresApprovalFor: z.array(ActionKindSchema).default([]),
    redactions: z.array(z.string()).default([]),
  }),
  createdAt: z.string().datetime(),
});

export const BrowserSkillManifestSchema = z.object({
  schemaVersion: z.literal(COMPUTER_USE_PROTOCOL_VERSION),
  skillId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  workflowId: z.string().min(1),
  version: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
});

export type Surface = z.infer<typeof SurfaceSchema>;
export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;
export type SessionSpec = z.infer<typeof SessionSpecSchema>;
export type DeviceTrust = z.infer<typeof DeviceTrustSchema>;
export type PairedDevice = z.infer<typeof PairedDeviceSchema>;
export type SurfacePresence = z.infer<typeof SurfacePresenceSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type BrowserRun = z.infer<typeof BrowserRunSchema>;
export type ExecutionLease = z.infer<typeof ExecutionLeaseSchema>;
export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;
export type ResumeCursor = z.infer<typeof ResumeCursorSchema>;
export type ObservationRef = z.infer<typeof ObservationRefSchema>;
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
export type BrowserObservation = z.infer<typeof BrowserObservationSchema>;
export type ActionKind = z.infer<typeof ActionKindSchema>;
export type ActionIntent = z.infer<typeof ActionIntentSchema>;
export type ActionState = z.infer<typeof ActionStateSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type Receipt = z.infer<typeof ReceiptSchema>;
export type BrowserEvent = z.infer<typeof BrowserEventSchema>;
export type BrowserTrajectoryStep = z.infer<typeof BrowserTrajectoryStepSchema>;
export type BrowserTrajectory = z.infer<typeof BrowserTrajectorySchema>;
export type BrowserWorkflowInput = z.infer<typeof BrowserWorkflowInputSchema>;
export type BrowserWorkflowStep = z.infer<typeof BrowserWorkflowStepSchema>;
export type BrowserWorkflowSpec = z.infer<typeof BrowserWorkflowSpecSchema>;
export type BrowserSkillManifest = z.infer<typeof BrowserSkillManifestSchema>;

export interface BrowserProvider {
  readonly capabilities: ProviderCapabilities;
  observe(sessionId: string): Promise<BrowserObservation>;
  execute(action: ActionIntent): Promise<BrowserEvent[]>;
  close(sessionId: string): Promise<void>;
}

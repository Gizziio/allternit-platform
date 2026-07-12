import { describe, expect, it } from "vitest";
import {
  ActionIntentSchema,
  BrowserEventSchema,
  BrowserObservationSchema,
  BrowserSkillManifestSchema,
  BrowserTrajectorySchema,
  BrowserWorkflowSpecSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  ExecutionLeaseSchema,
  HandoffRequestSchema,
  ProviderCapabilitiesSchema,
} from "./index.js";

const now = "2026-07-10T12:00:00.000Z";

describe("computer-use protocol v1", () => {
  it("uses one capability contract for an attached extension tab", () => {
    const parsed = ProviderCapabilitiesSchema.parse({
      provider: "extension-tab",
      capabilities: ["navigate", "observe.accessibility", "interact.pointer", "tabs"],
      local: true,
      attachedToUserSession: true,
      supportsPrivateNetwork: true,
      supportsPersistentProfile: true,
    });
    expect(parsed.provider).toBe("extension-tab");
  });

  it("rejects observations from another schema version", () => {
    expect(() => BrowserObservationSchema.parse({
      schemaVersion: "0.9",
      observationId: "obs_1",
      sessionId: "session_1",
      url: "https://example.com",
      title: "Example",
      capturedAt: now,
      format: "accessibility",
    })).toThrow();
  });

  it("validates shared actions and ordered events", () => {
    const action = ActionIntentSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      actionId: "action_1",
      runId: "run_1",
      sessionId: "session_1",
      kind: "click",
      reason: "Submit the verified form",
      targetRef: "e12",
    });
    const event = BrowserEventSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      eventId: "event_1",
      runId: action.runId,
      sessionId: action.sessionId,
      sequence: 3,
      emittedAt: now,
      sourceSurface: "extension",
      type: "action.state_changed",
      payload: { actionId: action.actionId, state: "executing" },
    });
    expect(event.sequence).toBe(3);
  });

  it("uses a monotonic lease epoch for cross-surface ownership", () => {
    const lease = ExecutionLeaseSchema.parse({
      leaseId: "lease_1",
      runId: "run_1",
      ownerSurfaceInstanceId: "extension_window_1",
      ownerDeviceId: "device_macbook",
      issuedAt: now,
      expiresAt: "2026-07-10T12:05:00.000Z",
      epoch: 2,
      nonce: "0123456789abcdef",
    });
    expect(lease.epoch).toBe(2);
  });

  it("carries the event cursor during a platform-to-extension handoff", () => {
    const handoff = HandoffRequestSchema.parse({
      handoffId: "handoff_1",
      runId: "run_1",
      fromSurfaceInstanceId: "platform_tab_1",
      toSurfaceInstanceId: "extension_window_1",
      requestedAt: now,
      lastAcknowledgedSequence: 41,
    });
    expect(handoff.lastAcknowledgedSequence).toBe(41);
  });

  it("validates trajectory, workflow, and skill artifacts", () => {
    const trajectory = BrowserTrajectorySchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      trajectoryId: "traj_1",
      runId: "run_1",
      sessionId: "session_1",
      objective: "Find pricing",
      createdAt: now,
      provider: "extension-tab",
      steps: [{
        stepId: "step_1",
        status: "committed",
        action: {
          schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
          actionId: "action_1",
          runId: "run_1",
          sessionId: "session_1",
          kind: "navigate",
          reason: "Open the pricing page",
          input: { url: "https://example.com/pricing" },
        },
      }],
    });
    const workflow = BrowserWorkflowSpecSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      workflowId: "workflow_1",
      title: "Find pricing",
      description: "Repeat the pricing lookup",
      sourceRunId: trajectory.runId,
      provider: trajectory.provider,
      steps: [{
        id: "step_1",
        kind: "navigate",
        input: { url: "https://example.com/pricing" },
        reason: "Open the pricing page",
      }],
      safety: { requiresApprovalFor: [], redactions: [] },
      createdAt: now,
    });
    const skill = BrowserSkillManifestSchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      skillId: "skill_1",
      name: "Find pricing",
      description: workflow.description,
      workflowId: workflow.workflowId,
      version: "1.0.0",
      tags: ["browser", "workflow"],
      createdAt: now,
    });
    expect(skill.workflowId).toBe(workflow.workflowId);
  });
});

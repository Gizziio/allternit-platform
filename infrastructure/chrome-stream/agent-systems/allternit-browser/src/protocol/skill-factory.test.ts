import { describe, expect, it } from 'vitest';
import { BrowserTrajectorySchema, COMPUTER_USE_PROTOCOL_VERSION } from '@allternit/computer-use-protocol';
import { compileBrowserTrajectoryToSkill } from './skill-factory.js';

describe('compileBrowserTrajectoryToSkill', () => {
  it('turns committed browser steps into a reusable workflow and skill manifest', () => {
    const trajectory = BrowserTrajectorySchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      trajectoryId: 'traj_checkout',
      runId: 'run_checkout',
      sessionId: 'session_checkout',
      objective: 'Check dashboard status',
      createdAt: '2026-07-10T20:00:00.000Z',
      provider: 'extension-tab',
      steps: [
        {
          stepId: 'open_dashboard',
          status: 'committed',
          action: {
            schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
            actionId: 'action_open',
            runId: 'run_checkout',
            sessionId: 'session_checkout',
            kind: 'navigate',
            reason: 'Open the dashboard',
            input: { url: 'https://example.com/dashboard' },
          },
        },
        {
          stepId: 'enter_email',
          status: 'committed',
          action: {
            schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
            actionId: 'action_type',
            runId: 'run_checkout',
            sessionId: 'session_checkout',
            kind: 'type',
            reason: 'Enter account email',
            targetRef: 'e2',
            input: { text: 'ops@example.com' },
          },
        },
      ],
    });
    const result = compileBrowserTrajectoryToSkill(trajectory, {
      now: () => new Date('2026-07-10T20:05:00.000Z'),
    });
    expect(result.workflow.steps).toHaveLength(2);
    expect(result.workflow.safety.redactions).toEqual(['input.text']);
    expect(result.workflow.steps[1].input.text).toBe('{{text}}');
    expect(result.workflow.safety.requiresApprovalFor).toContain('type');
    expect(result.manifest.workflowId).toBe(result.workflow.workflowId);
  });

  it('refuses to compile trajectories with no committed steps', () => {
    const trajectory = BrowserTrajectorySchema.parse({
      schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
      trajectoryId: 'traj_failed',
      runId: 'run_failed',
      sessionId: 'session_failed',
      objective: 'Try task',
      createdAt: '2026-07-10T20:00:00.000Z',
      provider: 'local-playwright',
      steps: [{
        stepId: 'failed_step',
        status: 'failed',
        action: {
          schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
          actionId: 'action_failed',
          runId: 'run_failed',
          sessionId: 'session_failed',
          kind: 'click',
          reason: 'Click missing control',
          input: {},
        },
      }],
    });
    expect(() => compileBrowserTrajectoryToSkill(trajectory)).toThrow('no committed steps');
  });
});

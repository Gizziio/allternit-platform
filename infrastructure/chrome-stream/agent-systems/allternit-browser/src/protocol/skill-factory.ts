import {
  BrowserSkillManifestSchema,
  BrowserWorkflowSpecSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  type ActionKind,
  type BrowserSkillManifest,
  type BrowserTrajectory,
  type BrowserWorkflowSpec,
} from '@allternit/computer-use-protocol';

export interface CompileBrowserSkillOptions {
  title?: string;
  description?: string;
  now?: () => Date;
  tags?: string[];
}

export interface BrowserSkillPackage {
  workflow: BrowserWorkflowSpec;
  manifest: BrowserSkillManifest;
}

const APPROVAL_ACTIONS = new Set<ActionKind>([
  'click',
  'type',
  'select',
  'press',
  'file.upload',
  'download',
  'dialog.accept',
  'dialog.dismiss',
]);

const SECRET_INPUT_NAMES = /password|passwd|passcode|token|secret|api[_-]?key|authorization|cookie|card|cvv|ssn/i;
const SENSITIVE_VALUE = /(?:\b\d{13,19}\b)|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

export function compileBrowserTrajectoryToSkill(
  trajectory: BrowserTrajectory,
  options: CompileBrowserSkillOptions = {},
): BrowserSkillPackage {
  const now = (options.now ?? (() => new Date()))().toISOString();
  const committedSteps = trajectory.steps.filter((step) => step.status === 'committed');
  if (committedSteps.length === 0) {
    throw new Error(`Trajectory ${trajectory.trajectoryId} has no committed steps to compile`);
  }
  const redactions = new Set<string>();
  const workflow = BrowserWorkflowSpecSchema.parse({
    schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
    workflowId: stableId('workflow', trajectory.trajectoryId),
    title: options.title ?? trajectory.objective,
    description: options.description ?? `Repeat browser task from run ${trajectory.runId}`,
    sourceRunId: trajectory.runId,
    provider: trajectory.provider,
    inputs: [],
    steps: committedSteps.map((step, index) => {
      const action = step.action;
      const input = sanitizeInput(action.input, redactions);
      return {
        id: step.stepId || `step_${index + 1}`,
        kind: action.kind,
        target: action.targetRef || action.targetDescription
          ? {
              ref: action.targetRef,
              description: action.targetDescription,
            }
          : undefined,
        input,
        reason: action.reason,
      };
    }),
    safety: {
      requiresApprovalFor: [...new Set(committedSteps
        .map((step) => step.action.kind)
        .filter((kind) => APPROVAL_ACTIONS.has(kind)))],
      redactions: [...redactions],
    },
    createdAt: now,
  });
  const manifest = BrowserSkillManifestSchema.parse({
    schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
    skillId: stableId('skill', trajectory.trajectoryId),
    name: workflow.title,
    description: workflow.description,
    workflowId: workflow.workflowId,
    version: '1.0.0',
    tags: options.tags ?? ['browser', 'workflow', trajectory.provider],
    createdAt: now,
  });
  return { workflow, manifest };
}

function sanitizeInput(input: Record<string, unknown>, redactions: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    if (SECRET_INPUT_NAMES.test(key)) {
      redactions.add(`input.${key}`);
      return [key, `{{${toInputName(key)}}}`];
    }
    if (typeof value === 'string' && SENSITIVE_VALUE.test(value)) {
      redactions.add(`input.${key}`);
      return [key, `{{${toInputName(key)}}}`];
    }
    if (Array.isArray(value)) {
      return [key, value.map((item) => typeof item === 'string' && SENSITIVE_VALUE.test(item) ? '{{redacted_value}}' : item)];
    }
    if (value && typeof value === 'object') {
      return [key, sanitizeInput(value as Record<string, unknown>, redactions)];
    }
    return [key, value];
  }));
}

function toInputName(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'redacted_value';
}

function stableId(prefix: string, source: string): string {
  return `${prefix}_${source.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()}`;
}

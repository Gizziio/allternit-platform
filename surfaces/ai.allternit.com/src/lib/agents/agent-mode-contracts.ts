import type { AgentModeId } from '@/stores/agent-surface-mode.store';

export type CanonicalAgentModeId =
  | 'swarms'
  | 'research'
  | 'website'
  | 'docs'
  | 'data'
  | 'slides'
  | 'image'
  | 'video';

export type AgentArtifactKind =
  | 'swarm-run'
  | 'research-report'
  | 'website'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'video';

export interface AgentModeContract {
  id: CanonicalAgentModeId;
  label: string;
  artifactKind: AgentArtifactKind;
  requiredCapabilities: string[];
  requiredEvidence: Array<'artifact' | 'tool-call' | 'citations' | 'swarm-run'>;
  systemPrompt: string;
}

export interface AgentModeExecutionEvidence {
  content: string;
  toolNames: string[];
  artifactCount: number;
}

export interface AgentModeExecutionValidation {
  status: 'complete' | 'blocked' | 'invalid';
  errors: string[];
}

const COMPLETION_LAW = `
MODE EXECUTION LAW:
- Do not claim completion from prose alone.
- Produce the required artifact and use the required capabilities.
- If a required capability or provider is unavailable, return MODE_EXECUTION_BLOCKED with the missing capability. Never simulate a successful artifact.
- Preserve the user's requested format and validate the deliverable before reporting success.
- End successful work with MODE_EXECUTION_COMPLETE and a concise artifact manifest.`;

export const AGENT_MODE_CONTRACTS: Record<CanonicalAgentModeId, AgentModeContract> = {
  swarms: {
    id: 'swarms', label: 'Agent Swarm', artifactKind: 'swarm-run',
    requiredCapabilities: ['swarm_orchestration', 'agent_communicate'],
    requiredEvidence: ['swarm-run', 'tool-call'],
    systemPrompt: `You are executing Agent Swarm mode. Create a real coordinated swarm run with named specialist roles, explicit task ownership, synthesis, and a final validated deliverable. A single-agent narrative is not a swarm run.${COMPLETION_LAW}`,
  },
  research: {
    id: 'research', label: 'Deep Research', artifactKind: 'research-report',
    requiredCapabilities: ['web_search', 'browser', 'file_write'],
    requiredEvidence: ['artifact', 'tool-call', 'citations'],
    systemPrompt: `You are executing Deep Research mode. Search multiple authoritative sources, distinguish evidence from inference, attach citations to claims, reconcile conflicting sources, and create a structured research-report artifact. Do not answer from memory alone.${COMPLETION_LAW}`,
  },
  website: {
    id: 'website', label: 'Websites', artifactKind: 'website',
    requiredCapabilities: ['generateWebArtifact', 'file_write'],
    requiredEvidence: ['artifact', 'tool-call'],
    systemPrompt: `You are executing Websites mode. Produce a runnable website artifact with complete HTML/CSS/JS or framework files, responsive behavior, accessible interaction, and no placeholder sections. Validate the artifact structure before completion.${COMPLETION_LAW}`,
  },
  docs: {
    id: 'docs', label: 'Docs', artifactKind: 'document',
    requiredCapabilities: ['document_create', 'file_write'],
    requiredEvidence: ['artifact', 'tool-call'],
    systemPrompt: `You are executing Docs mode. Produce an editable structured document artifact—not only chat markdown—with headings, semantic sections, consistent styles, and the requested professional format. Validate completeness and exportability.${COMPLETION_LAW}`,
  },
  data: {
    id: 'data', label: 'Sheets', artifactKind: 'spreadsheet',
    requiredCapabilities: ['spreadsheet_create', 'spreadsheet_formula', 'file_write'],
    requiredEvidence: ['artifact', 'tool-call'],
    systemPrompt: `You are executing Sheets mode. Produce an editable spreadsheet artifact with typed cells, formulas where appropriate, source-data preservation, and charts or analysis requested by the user. Validate formulas, ranges, and missing-data behavior.${COMPLETION_LAW}`,
  },
  slides: {
    id: 'slides', label: 'Slides', artifactKind: 'presentation',
    requiredCapabilities: ['presentation_create', 'file_write'],
    requiredEvidence: ['artifact', 'tool-call'],
    systemPrompt: `You are executing Slides mode. Produce an editable presentation artifact with a coherent narrative, slide-specific layouts, visual hierarchy, and speaker-ready content. Validate slide count, overflow, and required sections.${COMPLETION_LAW}`,
  },
  image: {
    id: 'image', label: 'Image', artifactKind: 'image',
    requiredCapabilities: ['image_generation'],
    requiredEvidence: ['artifact', 'tool-call'],
    systemPrompt: `You are executing Image mode. Call the image-generation capability and return a real image artifact matching the requested composition, dimensions, and constraints. A textual image description is not completion.${COMPLETION_LAW}`,
  },
  video: {
    id: 'video', label: 'Video', artifactKind: 'video',
    requiredCapabilities: ['video_generation'],
    requiredEvidence: ['artifact', 'tool-call'],
    systemPrompt: `You are executing Video mode. Call a validated video-generation provider and return a playable video artifact with the requested duration and format. A storyboard, EDL, or prose description alone is not completion.${COMPLETION_LAW}`,
  },
};

export function isCanonicalAgentMode(modeId: AgentModeId | string | null | undefined): modeId is CanonicalAgentModeId {
  return Boolean(modeId && modeId in AGENT_MODE_CONTRACTS);
}

export function getAgentModeContract(modeId: AgentModeId | string | null | undefined): AgentModeContract | null {
  return isCanonicalAgentMode(modeId) ? AGENT_MODE_CONTRACTS[modeId] : null;
}

export function buildModeSystemPrompt(contract: AgentModeContract, templateTitle?: string): string {
  return `${contract.systemPrompt}\n\nMODE: ${contract.id}\nREQUIRED ARTIFACT: ${contract.artifactKind}\nREQUIRED CAPABILITIES: ${contract.requiredCapabilities.join(', ')}${templateTitle ? `\nTEMPLATE: ${templateTitle}` : ''}`;
}

export function validateAgentModeExecution(
  contract: AgentModeContract,
  evidence: AgentModeExecutionEvidence,
): AgentModeExecutionValidation {
  if (evidence.content.includes('MODE_EXECUTION_BLOCKED')) {
    return { status: 'blocked', errors: [] };
  }

  const errors: string[] = [];
  if (!evidence.content.includes('MODE_EXECUTION_COMPLETE')) {
    errors.push('The runtime did not emit the required completion marker.');
  }
  if (contract.requiredEvidence.includes('tool-call') && evidence.toolNames.length === 0) {
    errors.push('No tool execution was recorded.');
  }
  if (contract.requiredEvidence.includes('artifact') && evidence.artifactCount === 0) {
    errors.push(`No ${contract.artifactKind} artifact was emitted.`);
  }
  if (contract.requiredEvidence.includes('citations')) {
    const hasCitation = /https?:\/\/\S+|\[[^\]]+\]\([^)]+\)|\[\d+\]/.test(evidence.content);
    if (!hasCitation) errors.push('No citations were found in the research result.');
  }
  if (contract.requiredEvidence.includes('swarm-run')) {
    const hasSwarmTool = evidence.toolNames.some((name) =>
      name.includes('agent_communicate') || name.includes('swarm'),
    );
    if (!hasSwarmTool) errors.push('No coordinated swarm execution was recorded.');
  }

  return { status: errors.length === 0 ? 'complete' : 'invalid', errors };
}

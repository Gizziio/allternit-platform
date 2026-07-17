/**
 * Host CLI agents that can be launched inside a canvas terminal tile.
 * Flags follow ~/.agent-orchestrator/ORCHESTRATOR.md — re-verify with
 * `ao-doctor` when the CLIs change (flags drift between versions).
 */

export type AgentVendorId = 'kimi' | 'codex' | 'claude' | 'agy';

export interface AgentVendor {
  id: AgentVendorId;
  label: string;
  command: string;
}

export const AGENT_VENDORS: AgentVendor[] = [
  { id: 'kimi', label: 'Kimi', command: 'kimi --yolo' },
  { id: 'codex', label: 'Codex', command: 'codex --dangerously-bypass-approvals-and-sandbox' },
  { id: 'claude', label: 'Claude', command: 'claude --dangerously-skip-permissions' },
  { id: 'agy', label: 'Agy', command: 'agy --dangerously-skip-permissions' },
];

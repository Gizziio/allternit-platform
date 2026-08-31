/**
 * Human handoff manager for sensitive browser-agent actions.
 *
 * When the safety layer detects a CAPTCHA, payment, identity verification,
 * or other sensitive action, it pauses the agent and asks the user through
 * the sidepanel. The user must explicitly approve before execution resumes.
 */

export interface HandoffRequest {
  id: string;
  action: string;
  reason: string;
  details?: Record<string, unknown>;
  resolved: boolean;
  approved?: boolean;
}

const STORAGE_KEY = 'allternit_agent_handoffs';

export async function createHandoff(
  action: string,
  reason: string,
  details?: Record<string, unknown>,
): Promise<HandoffRequest> {
  const request: HandoffRequest = {
    id: crypto.randomUUID(),
    action,
    reason,
    details,
    resolved: false,
  };
  const existing = await listHandoffs();
  existing.push(request);
  await chrome.storage.local.set({ [STORAGE_KEY]: existing });
  return request;
}

export async function listHandoffs(): Promise<HandoffRequest[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as HandoffRequest[]) || [];
}

export async function resolveHandoff(
  id: string,
  approved: boolean,
): Promise<HandoffRequest | null> {
  const handoffs = await listHandoffs();
  const target = handoffs.find((h) => h.id === id);
  if (!target) return null;
  target.resolved = true;
  target.approved = approved;
  await chrome.storage.local.set({ [STORAGE_KEY]: handoffs });
  return target;
}

export async function clearResolvedHandoffs(): Promise<void> {
  const handoffs = await listHandoffs();
  const pending = handoffs.filter((h) => !h.resolved);
  await chrome.storage.local.set({ [STORAGE_KEY]: pending });
}

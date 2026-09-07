/**
 * Skills / task recipes API client for the extension.
 */

const GATEWAY_URL = 'http://127.0.0.1:8013';

export interface Skill {
  id: string;
  name: string;
  description?: string | null;
  goal_template: string;
  parameters: Record<string, unknown>;
  allowed_sites?: unknown;
  run_count: number;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  goal_template: string;
  parameters?: Record<string, unknown>;
  allowed_sites?: unknown;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get('AllternitClerkJwt');
  const token = result.AllternitClerkJwt;
  if (!token) {
    throw new Error('Not authenticated with Allternit');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function listSkills(search?: string): Promise<Skill[]> {
  const url = new URL(`${GATEWAY_URL}/api/v1/skills`);
  if (search) url.searchParams.set('search', search);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Skills list failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { skills: Skill[] };
  return data.skills || [];
}

export async function createSkill(skill: CreateSkillRequest): Promise<{ id: string }> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/skills`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(skill),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Skill create failed: ${response.status} ${text}`);
  }
  return (await response.json()) as { id: string };
}

export async function runSkill(skillId: string, parameters: Record<string, unknown>): Promise<{ goal: string }> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/skills/${skillId}/run`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ parameters }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Skill run failed: ${response.status} ${text}`);
  }
  return (await response.json()) as { goal: string };
}

export async function deleteSkill(skillId: string): Promise<void> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/skills/${skillId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Skill delete failed: ${response.status} ${text}`);
  }
}

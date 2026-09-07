/**
 * Long-running autonomous task client for the extension.
 *
 * Tasks persist server-side so they survive sidepanel closures. The background
 * script polls active tasks and forwards updates to the sidepanel via
 * chrome.runtime messages.
 */

const GATEWAY_URL = 'http://127.0.0.1:8013';

export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface LongRunningTask {
  id: string;
  title: string;
  goal: string;
  status: TaskStatus;
  progress: number;
  result?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
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

export async function listLongRunningTasks(status?: TaskStatus): Promise<LongRunningTask[]> {
  const url = new URL(`${GATEWAY_URL}/api/v1/long-tasks`);
  if (status) url.searchParams.set('status', status);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Long tasks list failed: ${response.status} ${text}`);
  }
  const data = (await response.json()) as { tasks: LongRunningTask[] };
  return data.tasks || [];
}

export async function createLongRunningTask(title: string, goal: string): Promise<{ id: string }> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/long-tasks`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ title, goal }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Long task create failed: ${response.status} ${text}`);
  }
  return (await response.json()) as { id: string };
}

export async function getLongRunningTask(id: string): Promise<LongRunningTask> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/long-tasks/${id}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Long task get failed: ${response.status} ${text}`);
  }
  return (await response.json()) as LongRunningTask;
}

export async function cancelLongRunningTask(id: string): Promise<void> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/long-tasks/${id}/cancel`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Long task cancel failed: ${response.status} ${text}`);
  }
}

export async function deleteLongRunningTask(id: string): Promise<void> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/long-tasks/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Long task delete failed: ${response.status} ${text}`);
  }
}

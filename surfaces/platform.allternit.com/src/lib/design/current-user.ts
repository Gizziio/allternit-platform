// Current-user profile client (adapted for platform.allternit.com).
//
// Talks to the Allternit gateway at /api/v1/me. The platform console reads
// the backend-resolved organization so self-hosted/no-Clerk builds can still
// display org context, and can create a personal org when none exists.

export interface CurrentUserProfile {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  organization_id?: string | null;
  organization_role?: string | null;
}

function gatewayBase(): string {
  const configured = import.meta.env.VITE_ALLTERNIT_GATEWAY_URL || 'https://api.allternit.com';
  return String(configured).replace(/\/+$/, '');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${gatewayBase()}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const data = await request<{ user: CurrentUserProfile }>('/api/v1/me');
  return data.user;
}

export interface CreatePersonalOrganizationResult {
  organization_id: string;
  created: boolean;
}

export async function createPersonalOrganization(): Promise<CreatePersonalOrganizationResult> {
  return request<CreatePersonalOrganizationResult>('/api/v1/me/organization', { method: 'POST' });
}

// Current-user profile client.
//
// Talks to /api/v1/me (cmd/allternit-api/src/me_routes.rs). Exists so
// self-hosted/no-Clerk-key UI (EnterpriseByocPanel, OrganizationAccessPanel)
// can read the organization this request actually resolves to, and create a
// personal one when there isn't one yet -- auth_middleware does NOT
// auto-synthesize an organization (real Clerk deployments get org scope from
// Clerk's own org-creation flow instead), so a self-hosted build with no
// Clerk key configured at all needs its own explicit path to create one.

export interface CurrentUserProfile {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  organization_id?: string | null;
  organization_role?: string | null;
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const res = await fetch('/api/v1/me');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data.user as CurrentUserProfile;
}

export interface CreatePersonalOrganizationResult {
  organization_id: string;
  created: boolean;
}

export async function createPersonalOrganization(): Promise<CreatePersonalOrganizationResult> {
  const res = await fetch('/api/v1/me/organization', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as CreatePersonalOrganizationResult;
}

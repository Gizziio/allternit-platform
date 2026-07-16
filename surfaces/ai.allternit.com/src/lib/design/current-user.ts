// Current-user profile client.
//
// Talks to /api/v1/me (cmd/allternit-api/src/me_routes.rs). Exists
// specifically so org-scoped UI (EnterpriseByocPanel) can read the
// organization this request actually resolves to -- auth_middleware
// synthesizes a personal organization server-side when Clerk reports none,
// so organization_id/organization_role must come from here, never from
// Clerk's own org state (usePlatformAuth().orgId), which stays null unless
// Clerk Organizations is explicitly configured and an org is selected.

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

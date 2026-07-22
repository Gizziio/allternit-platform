//! Shared "is this caller an org admin/owner" check.
//!
//! Previously duplicated as three separate `query_row` + `matches!` blocks in
//! `usage_routes.rs`, `cloud_credentials_routes.rs`, and
//! `llm_gateway/admin_routes.rs`. Workspace-level (as opposed to
//! organization-level) role checks embedded directly in larger SQL joins
//! (`workspace_routes.rs`, `team_skill_routes.rs`, `cowork_team_routes.rs`)
//! are intentionally left as-is here — rewriting those query strings by hand
//! without a compiler available on this machine to verify the result is a
//! real risk to live authorization logic, not just a style nit.

use rusqlite::OptionalExtension;

/// True if `role` is one of the roles allowed to administer an organization.
pub fn is_admin_role(role: Option<&str>) -> bool {
    matches!(role, Some("owner") | Some("admin"))
}

/// Looks up `user_id`'s role in `organization_id` and reports whether it's
/// an admin role. `Ok(false)` (not an error) if the user has no membership
/// row at all.
pub fn is_org_admin(
    conn: &rusqlite::Connection,
    organization_id: &str,
    user_id: &str,
) -> Result<bool, rusqlite::Error> {
    let role: Option<String> = conn
        .query_row(
            "SELECT role FROM organization_members WHERE organization_id = ?1 AND user_id = ?2",
            rusqlite::params![organization_id, user_id],
            |row| row.get(0),
        )
        .optional()?;
    Ok(is_admin_role(role.as_deref()))
}

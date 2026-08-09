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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-rbac-test-{}.db", id));
        let db = DbHandle::new(path.clone()).unwrap();
        (path.to_string_lossy().to_string(), db)
    }

    fn seed_org_and_user(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            rusqlite::params![org_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
        )
        .unwrap();
    }

    #[test]
    fn admin_role_recognizes_owners_and_admins() {
        assert!(is_admin_role(Some("owner")));
        assert!(is_admin_role(Some("admin")));
        assert!(!is_admin_role(Some("member")));
        assert!(!is_admin_role(None));
        assert!(!is_admin_role(Some("")));
    }

    #[test]
    fn is_org_admin_matches_member_role() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_and_user(&conn, "org-1", "user-1", "owner");
        seed_org_and_user(&conn, "org-1", "user-2", "member");

        assert!(is_org_admin(&conn, "org-1", "user-1").unwrap());
        assert!(!is_org_admin(&conn, "org-1", "user-2").unwrap());
        assert!(!is_org_admin(&conn, "org-1", "user-missing").unwrap());

        let _ = std::fs::remove_file(&path);
    }
}

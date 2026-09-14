//! Managed-runtime local provision (consumer desktop P1): the
//! `ensure_gizzi_principal` store helper must upsert the canonical gizzi
//! worker principal for a workspace (idempotent, credential-preserving) so
//! the desktop's ensure route can provision a fresh token on top.

use allternit_cowork_runtime::sqlite_store;
use rusqlite::Connection;

fn open() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    let mut conn = conn;
    sqlite_store::apply_store_ddl(&mut conn).unwrap();
    conn
}

fn principal_row(conn: &Connection, id: &str) -> Option<(String, String, Option<String>)> {
    conn.query_row(
        "SELECT workspace, capabilities, token_hash FROM cowork_principals WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )
    .ok()
}

#[test]
fn ensure_gizzi_principal_creates_canonical_record() {
    let mut conn = open();
    let id = sqlite_store::ensure_gizzi_principal(&mut conn, "default").unwrap();
    assert_eq!(id, "a://workspace/default/principal/gizzi");
    let (workspace, caps, token_hash) = principal_row(&conn, &id).expect("principal row");
    assert_eq!(workspace, "default");
    let caps: Vec<String> = serde_json::from_str(&caps).unwrap();
    assert!(caps.contains(&"compute.local".to_string()));
    assert!(caps.contains(&"shell.exec".to_string()));
    assert!(token_hash.is_none(), "ensure never touches credentials");
}

#[test]
fn ensure_gizzi_principal_idempotent_and_preserves_credential() {
    let mut conn = open();
    let id = sqlite_store::ensure_gizzi_principal(&mut conn, "acme").unwrap();
    // Provision a token, then ensure again — the credential must survive.
    let token = sqlite_store::provision_principal_token(&mut conn, &id).unwrap();
    assert!(token.starts_with("atok_"));
    let id2 = sqlite_store::ensure_gizzi_principal(&mut conn, "a://workspace/acme").unwrap();
    assert_eq!(id, id2, "full URI workspace normalizes to the same principal");
    let (_, _, token_hash) = principal_row(&conn, &id).expect("principal row");
    assert!(token_hash.is_some(), "re-ensure must not clear the credential");
    // And a fresh provision rotates: the old token must no longer authenticate.
    let _rotated = sqlite_store::provision_principal_token(&mut conn, &id).unwrap();
    let auth = sqlite_store::authenticate_principal(&mut conn, &token);
    assert!(auth.is_err(), "rotated token is dead");
}

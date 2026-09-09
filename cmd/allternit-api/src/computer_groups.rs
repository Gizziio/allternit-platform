//! Owner-scoped labels for organizing computers. Membership is a single nullable FK.
use crate::computer_routes::{computer_visibility_clause, error_response, resolve_org_id};
use crate::{auth::AuthUser, AppState};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct ComputerGroup {
    pub id: String,
    pub owner_type: String,
    pub owner_id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub member_count: i64,
}
#[derive(Deserialize)]
struct GroupInput {
    name: String,
}
type GroupResult<T> = Result<T, (StatusCode, String)>;
fn db_error(e: rusqlite::Error) -> (StatusCode, String) {
    tracing::warn!(error = %e, "computer group database error");
    if matches!(&e, rusqlite::Error::SqliteFailure(error, _) if error.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE)
    {
        (
            StatusCode::CONFLICT,
            "a computer group with that name already exists".into(),
        )
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "computer group database error".into(),
        )
    }
}
fn not_found() -> (StatusCode, String) {
    (
        StatusCode::NOT_FOUND,
        "computer group or computer not found".into(),
    )
}
fn valid_name(name: &str) -> GroupResult<&str> {
    let name = name.trim();
    if name.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "name must not be empty".into()));
    }
    Ok(name)
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/computer-groups", get(list_groups).post(create_group))
        .route(
            "/computer-groups/:id",
            get(get_group).patch(rename_group).delete(delete_group),
        )
        .route(
            "/computer-groups/:id/computers/:computer_id",
            post(attach).delete(detach),
        )
}

fn scoped_groups(
    conn: &Connection,
    user: &AuthUser,
    id: Option<&str>,
) -> GroupResult<Vec<ComputerGroup>> {
    let mut stmt = conn.prepare("SELECT g.id, g.owner_type, g.owner_id, g.name, g.created_at, g.updated_at,
        (SELECT COUNT(*) FROM computers c WHERE c.group_id=g.id AND c.status != 'deleted')
        FROM computer_groups g WHERE ((g.owner_type='user' AND g.owner_id=?1) OR (g.owner_type='org' AND g.owner_id=?2))
        AND (?3 IS NULL OR g.id=?3) ORDER BY g.name, g.id").map_err(db_error)?;
    let rows = stmt
        .query_map(params![user.user_id, resolve_org_id(user), id], |r| {
            Ok(ComputerGroup {
                id: r.get(0)?,
                owner_type: r.get(1)?,
                owner_id: r.get(2)?,
                name: r.get(3)?,
                created_at: r.get(4)?,
                updated_at: r.get(5)?,
                member_count: r.get(6)?,
            })
        })
        .map_err(db_error)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(db_error)
}
fn visible_group(conn: &Connection, user: &AuthUser, id: &str) -> GroupResult<ComputerGroup> {
    scoped_groups(conn, user, Some(id))?
        .pop()
        .ok_or_else(not_found)
}

async fn run<T: Send + 'static>(
    state: &AppState,
    work: impl FnOnce(&mut Connection) -> GroupResult<T> + Send + 'static,
) -> GroupResult<T> {
    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = db.connect().map_err(db_error)?;
        conn.pragma_update(None, "foreign_keys", true)
            .map_err(db_error)?;
        work(&mut conn)
    })
    .await
    .map_err(|e| {
        tracing::warn!(%e, "computer group task failed");
        (StatusCode::INTERNAL_SERVER_ERROR, "internal error".into())
    })?
}
fn respond<T: Serialize>(result: GroupResult<T>, status: StatusCode) -> Response {
    match result {
        Ok(value) => (status, Json(value)).into_response(),
        Err((status, error)) => error_response(status, error),
    }
}
pub(crate) async fn require_visible_group(
    state: &AppState,
    user: &AuthUser,
    id: &str,
) -> Result<(), Response> {
    let user = user.clone();
    let id = id.to_owned();
    run(state, move |conn| {
        visible_group(conn, &user, &id).map(|_| ())
    })
    .await
    .map_err(|(s, e)| error_response(s, e))
}
async fn list_groups(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    respond(
        run(&state, move |conn| {
            scoped_groups(conn, &user, None).map(|groups| json!({"groups":groups}))
        })
        .await,
        StatusCode::OK,
    )
}
fn create_group_row(conn: &Connection, user: &AuthUser, name: &str) -> GroupResult<ComputerGroup> {
    let name = valid_name(name)?;
    let (owner_type, owner_id) = resolve_org_id(user)
        .map(|id| ("org", id))
        .unwrap_or_else(|| ("user", user.user_id.clone()));
    let id = format!("group-{}", uuid::Uuid::new_v4().simple());
    conn.execute(
        "INSERT INTO computer_groups (id, owner_type, owner_id, name) VALUES (?1,?2,?3,?4)",
        params![id, owner_type, owner_id, name],
    )
    .map_err(db_error)?;
    visible_group(conn, user, &id)
}
async fn create_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(input): Json<GroupInput>,
) -> Response {
    respond(
        run(&state, move |conn| {
            create_group_row(conn, &user, &input.name)
        })
        .await,
        StatusCode::CREATED,
    )
}
async fn get_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    respond(
        run(&state, move |conn| visible_group(conn, &user, &id)).await,
        StatusCode::OK,
    )
}
fn rename_group_row(
    conn: &mut Connection,
    user: &AuthUser,
    id: &str,
    name: &str,
) -> GroupResult<ComputerGroup> {
    let tx = conn.transaction().map_err(db_error)?;
    visible_group(&tx, user, id)?;
    let name = valid_name(name)?;
    tx.execute(
        "UPDATE computer_groups SET name=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2",
        params![name, id],
    )
    .map_err(db_error)?;
    let group = visible_group(&tx, user, id)?;
    tx.commit().map_err(db_error)?;
    Ok(group)
}
async fn rename_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(input): Json<GroupInput>,
) -> Response {
    respond(
        run(&state, move |conn| {
            rename_group_row(conn, &user, &id, &input.name)
        })
        .await,
        StatusCode::OK,
    )
}
fn delete_group_row(conn: &mut Connection, user: &AuthUser, id: &str) -> GroupResult<()> {
    let tx = conn.transaction().map_err(db_error)?;
    visible_group(&tx, user, id)?;
    tx.execute("DELETE FROM computer_groups WHERE id=?1", [id])
        .map_err(db_error)?;
    tx.commit().map_err(db_error)
}
async fn delete_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    match run(&state, move |conn| delete_group_row(conn, &user, &id)).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err((s, e)) => error_response(s, e),
    }
}
fn change_membership(
    conn: &mut Connection,
    user: &AuthUser,
    group_id: &str,
    computer_id: &str,
    attach: bool,
) -> GroupResult<serde_json::Value> {
    let tx = conn.transaction().map_err(db_error)?;
    visible_group(&tx, user, group_id)?;
    let org = resolve_org_id(user);
    let sql=format!("SELECT c.group_id FROM computers c LEFT JOIN agents a ON a.id=c.bot_id WHERE c.id=?1 AND c.status!='deleted' AND {}",computer_visibility_clause(2,Some(3)));
    let previous: Option<Option<String>> = tx
        .query_row(&sql, params![computer_id, user.user_id, org], |r| r.get(0))
        .optional()
        .map_err(db_error)?;
    let previous = previous.ok_or_else(not_found)?;
    if !attach && previous.as_deref() != Some(group_id) {
        return Err(not_found());
    }
    tx.execute(
        "UPDATE computers SET group_id=?1, updated_at=CURRENT_TIMESTAMP WHERE id=?2",
        params![if attach { Some(group_id) } else { None }, computer_id],
    )
    .map_err(db_error)?;
    tx.commit().map_err(db_error)?;
    let mut response =
        json!({"computer_id":computer_id,"group_id":if attach {Some(group_id)} else {None}});
    if attach && previous.as_deref().is_some_and(|id| id != group_id) {
        response["moved_from"] = json!(previous);
    }
    Ok(response)
}
async fn attach(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, computer_id)): Path<(String, String)>,
) -> Response {
    respond(
        run(&state, move |conn| {
            change_membership(conn, &user, &id, &computer_id, true)
        })
        .await,
        StatusCode::OK,
    )
}
async fn detach(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, computer_id)): Path<(String, String)>,
) -> Response {
    respond(
        run(&state, move |conn| {
            change_membership(conn, &user, &id, &computer_id, false)
        })
        .await,
        StatusCode::OK,
    )
}

#[cfg(test)]
mod computer_group_tests {
    use super::*;
    fn user(id: &str, org: Option<&str>) -> AuthUser {
        AuthUser {
            user_id: id.into(),
            organization_id: org.map(Into::into),
            tenant_id: None,
            email: None,
            name: None,
            avatar_url: None,
            organization_role: None,
            organization_slug: None,
        }
    }
    #[test]
    fn computer_groups_crud_is_scoped_and_duplicates_conflict() {
        let mut conn = crate::computer_routes::phase_two_test_db();
        let alice = user("alice", None);
        let bob = user("bob", None);
        let a = create_group_row(&conn, &alice, "Work").unwrap();
        let b = create_group_row(&conn, &bob, "Work").unwrap();
        assert_eq!(
            create_group_row(&conn, &alice, "Work").unwrap_err().0,
            StatusCode::CONFLICT
        );
        assert_eq!(scoped_groups(&conn, &alice, None).unwrap().len(), 1);
        assert!(visible_group(&conn, &alice, &b.id).is_err());
        assert_eq!(
            rename_group_row(&mut conn, &alice, &b.id, "No")
                .unwrap_err()
                .0,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            delete_group_row(&mut conn, &alice, &b.id).unwrap_err().0,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            rename_group_row(&mut conn, &alice, &a.id, "New")
                .unwrap()
                .name,
            "New"
        );
        let org_user = user("alice", Some("org"));
        let org_group = create_group_row(&conn, &org_user, "Team").unwrap();
        assert_eq!(org_group.owner_type, "org");
        assert_eq!(scoped_groups(&conn, &org_user, None).unwrap().len(), 2);
        assert!(visible_group(&conn, &user("bob", Some("org")), &org_group.id).is_ok());
        assert!(visible_group(&conn, &user("alice", Some("other")), &org_group.id).is_err());
        delete_group_row(&mut conn, &alice, &a.id).unwrap();
        assert!(visible_group(&conn, &alice, &a.id).is_err());
    }
    #[test]
    fn computer_group_move_detach_and_delete_fk() {
        let mut conn = crate::computer_routes::phase_two_test_db();
        conn.execute_batch(
            "INSERT INTO agents VALUES ('bot-a','alice'),('bot-b','bob');
            INSERT INTO computers (id,kind,provider,owner_type,owner_id,name,bot_id) VALUES
            ('a','cloud_desktop','incus','user','alice','A',NULL),
            ('b','cloud_desktop','incus','user','bob','B',NULL),
            ('bot-a','cloud_desktop','incus','bot','bot-a','Bot A','bot-a'),
            ('bot-b','cloud_desktop','incus','bot','bot-b','Bot B','bot-b');",
        )
        .unwrap();
        let alice = user("alice", None);
        let bob = user("bob", None);
        let first = create_group_row(&conn, &alice, "First").unwrap();
        let second = create_group_row(&conn, &alice, "Second").unwrap();
        assert!(change_membership(&mut conn, &bob, &first.id, "b", true).is_err());
        assert!(change_membership(&mut conn, &alice, &first.id, "b", true).is_err());
        assert!(change_membership(&mut conn, &alice, &first.id, "bot-b", true).is_err());
        change_membership(&mut conn, &alice, &first.id, "a", true).unwrap();
        change_membership(&mut conn, &alice, &first.id, "bot-a", true).unwrap();
        assert_eq!(
            visible_group(&conn, &alice, &first.id)
                .unwrap()
                .member_count,
            2
        );
        let moved = change_membership(&mut conn, &alice, &second.id, "a", true).unwrap();
        assert_eq!(moved["moved_from"], first.id);
        assert_eq!(
            visible_group(&conn, &alice, &first.id)
                .unwrap()
                .member_count,
            1
        );
        assert_eq!(
            visible_group(&conn, &alice, &second.id)
                .unwrap()
                .member_count,
            1
        );
        assert!(change_membership(&mut conn, &alice, &first.id, "a", false).is_err());
        change_membership(&mut conn, &alice, &second.id, "a", false).unwrap();
        change_membership(&mut conn, &alice, &second.id, "a", true).unwrap();
        delete_group_row(&mut conn, &alice, &second.id).unwrap();
        assert!(conn
            .query_row(
                "SELECT group_id IS NULL FROM computers WHERE id='a'",
                [],
                |r| r.get::<_, bool>(0)
            )
            .unwrap());
    }
}

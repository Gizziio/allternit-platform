//! BYO-VPS deploy wizard mount.
//!
//! Hosts the `allternit-cloud-wizard` router inside the cloud API behind
//! Clerk auth. The wizard crate is auth-agnostic: this module verifies the
//! Clerk session per request (the same `clerk::user_from_headers` pattern as
//! `gizzi_instances`/`mesh`) and injects the wizard's `AuthenticatedUser`
//! extension. It also wires the wizard's host-dependent services:
//!
//! - `SqliteCheckpointStore` over the shared pool (migration 019), encrypted
//!   with the credential cipher when configured,
//! - a `MeshKeyMinter` over [`MeshService`] (preauth key minted BEFORE the
//!   SSH bootstrap run; the key only lands in the 0600 env file on the box),
//! - an `InstanceRegistrar` that writes the `gizzi_instances` row directly —
//!   the API knows the user id, mesh IP, and port, so no credentials are
//!   handed to the VPS.

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
    Router,
};
use std::sync::Arc;

use allternit_cloud_wizard::{
    AuthenticatedUser, InstanceRegistrar, MeshKeyMinter, PairingBootstrap, PairingBootstrapMinter,
    SqliteCheckpointStore, WizardAppState,
};

use crate::{auth::clerk, routes::mesh::MeshService, ApiError, ApiState};

/// Wizard state shared across all wizard requests, built once at startup.
pub struct WizardHost {
    pub router_state: Arc<WizardAppState>,
}

/// Build the wizard router with its host services wired from [`ApiState`].
pub fn routes(state: &Arc<ApiState>) -> Router<Arc<ApiState>> {
    let checkpoint_store = Arc::new(SqliteCheckpointStore::new(
        state.db.clone(),
        state.credential_cipher.clone(),
    ));

    let mut wizard_state = WizardAppState::new(checkpoint_store);
    if let Some(mesh) = &state.mesh_service {
        wizard_state = wizard_state.with_mesh_minter(Arc::new(HeadscaleMinter {
            mesh: mesh.clone(),
        }));
    }
    wizard_state = wizard_state.with_registrar(Arc::new(GizziRegistrar {
        db: state.db.clone(),
    }));
    wizard_state = wizard_state.with_pairing_minter(Arc::new(ByoPairingMinter {
        db: state.db.clone(),
    }));

    Router::new()
        .merge(allternit_cloud_wizard::create_wizard_router(Arc::new(
            wizard_state,
        )))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            clerk_user_extension,
        ))
}

/// Verifies the Clerk session and injects the wizard's `AuthenticatedUser`.
/// Answers 401 (via the shared ApiError mapping) when the session is absent
/// or invalid. Also provisions the `users` row: `wizard_sessions.user_id`
/// references it, and a first-time wizard user otherwise dies on the FK
/// (mirrors `gizzi_instances::ensure_user_row`).
async fn clerk_user_extension(
    State(state): State<Arc<ApiState>>,
    mut request: Request,
    next: Next,
) -> Response {
    let user = match clerk::user_from_headers(request.headers()).await {
        Ok(user) => user,
        Err(error) => return error.into_response(),
    };
    let email = user
        .email
        .clone()
        .unwrap_or_else(|| format!("{}@users.allternit.local", user.id));
    let provisioned = sqlx::query(
        r#"
        INSERT INTO users (id, email, name, avatar_url, status, last_login_at)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            email = excluded.email,
            name = COALESCE(excluded.name, users.name),
            avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
            status = 'active',
            last_login_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(&user.id)
    .bind(&email)
    .bind(user.name.as_deref())
    .bind(user.image_url.as_deref())
    .execute(&state.db)
    .await;
    if let Err(error) = provisioned {
        return ApiError::from(error).into_response();
    }
    request.extensions_mut().insert(AuthenticatedUser {
        user_id: user.id,
    });
    next.run(request).await
}

/// Mints Headscale preauth keys through the shared mesh service.
struct HeadscaleMinter {
    mesh: Arc<MeshService>,
}

#[async_trait::async_trait]
impl MeshKeyMinter for HeadscaleMinter {
    async fn mint(
        &self,
        user_id: &str,
    ) -> Result<allternit_cloud_wizard::MeshBootstrap, String> {
        let enrollment = self
            .mesh
            .enroll(user_id)
            .await
            .map_err(|e| e.to_string())?;
        Ok(allternit_cloud_wizard::MeshBootstrap {
            auth_key: enrollment.auth_key,
            control_url: enrollment.control_url,
        })
    }
}

/// Writes the bootstrapped box into the gizzi instance registry as the
/// provisioning user.
struct GizziRegistrar {
    db: sqlx::SqlitePool,
}

#[async_trait::async_trait]
impl InstanceRegistrar for GizziRegistrar {
    async fn register(&self, user_id: &str, name: &str, url: &str) -> Result<(), String> {
        // gizzi_instances.user_id references users(id); backfill a placeholder
        // row if the user has never touched another flow (mirrors the
        // device-token branch of gizzi_instances::ensure_user_row).
        let email = format!("{}@users.allternit.local", user_id.replace('@', "_"));
        sqlx::query(
            r#"
            INSERT INTO users (id, email, status, last_login_at)
            VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(&email)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        crate::routes::gizzi_instances::upsert_instance(&self.db, user_id, name, url)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Mints one-time BYO runtime-pairing bootstrap tokens (migration 021). The
/// token hash is stored server-side; the plaintext token only ever travels
/// into the 0600 env file on the box being bootstrapped, which exchanges it
/// for an approved runtime-device pairing during bootstrap.
struct ByoPairingMinter {
    db: sqlx::SqlitePool,
}

/// BYO bootstrap tokens are valid for one hour: the wizard mints immediately
/// before the SSH run, and a retry re-mints.
const BYO_BOOTSTRAP_TOKEN_TTL: chrono::Duration = chrono::Duration::hours(1);

#[async_trait::async_trait]
impl PairingBootstrapMinter for ByoPairingMinter {
    async fn mint(&self, user_id: &str, instance_name: &str) -> Result<PairingBootstrap, String> {
        let token = crate::routes::runtime_pairing::random_secret(32);
        let id = format!("bt_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(
            r#"
            INSERT INTO byo_bootstrap_tokens (id, user_id, instance_name, token_hash, expires_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(instance_name)
        .bind(crate::routes::runtime_pairing::sha256_hex(token.as_bytes()))
        .bind(chrono::Utc::now() + BYO_BOOTSTRAP_TOKEN_TTL)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        // Same env convention as the hosted runtime service
        // (services/fly_runtime_service.rs).
        let cloud_api_url = std::env::var("ALLTERNIT_CLOUD_API_URL")
            .unwrap_or_else(|_| "https://allternit-cloud-api.fly.dev".to_string());
        Ok(PairingBootstrap {
            cloud_api_url,
            bootstrap_token: token,
        })
    }
}

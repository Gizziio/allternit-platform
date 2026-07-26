//! Wizard API Handlers
//!
//! Request handlers for the deployment wizard with checkpoint persistence.
//!
//! All handlers are scoped to an [`AuthenticatedUser`], injected as a request
//! extension by the hosting service's auth middleware (the wizard crate is
//! auth-agnostic; allternit-cloud-api installs Clerk verification in front of
//! these routes). Wizard checkpoints carry provider tokens and SSH keys, so
//! every store operation is user-scoped and every response is redacted.

use crate::bootstrap::{self, BootstrapConfig, MeshBootstrap, SshAuth};
use crate::capability::{AuthMethod, SupportedProvider};
use crate::checkpoint_store::{CheckpointStore, IdempotencyKey};
use crate::preflight::PreflightChecker;
use crate::provider::{driver_for, CreateServerRequest};
use crate::state_machine::{WizardState, WizardStep};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

/// How long provisioning waits for a new server to become SSH-ready.
const PROVISION_READY_TIMEOUT: Duration = Duration::from_secs(300);

/// Authenticated wizard user, inserted into request extensions by the hosting
/// service's auth middleware.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
}

/// Minted Headscale enrollment for the box being bootstrapped. Implemented by
/// the hosting service (cloud-api) over its MeshService.
#[async_trait::async_trait]
pub trait MeshKeyMinter: Send + Sync {
    async fn mint(&self, user_id: &str) -> Result<MeshBootstrap, String>;
}

/// Writes the bootstrapped box into the platform gizzi instance registry.
/// Implemented by the hosting service (cloud-api) — the API writes the row
/// directly; no credentials are handed to the VPS.
#[async_trait::async_trait]
pub trait InstanceRegistrar: Send + Sync {
    async fn register(&self, user_id: &str, name: &str, url: &str) -> Result<(), String>;
}

/// Wizard application state
pub struct WizardAppState {
    pub checkpoint_store: Arc<dyn CheckpointStore>,
    pub idempotency_store: Arc<crate::checkpoint_store::IdempotencyStore>,
    /// Headscale preauth key minter; absent when mesh is not configured.
    pub mesh_minter: Option<Arc<dyn MeshKeyMinter>>,
    /// gizzi instance registry writer; absent when registration is disabled.
    pub registrar: Option<Arc<dyn InstanceRegistrar>>,
}

impl WizardAppState {
    pub fn new(checkpoint_store: Arc<dyn CheckpointStore>) -> Self {
        Self {
            checkpoint_store,
            idempotency_store: Arc::new(crate::checkpoint_store::IdempotencyStore::new()),
            mesh_minter: None,
            registrar: None,
        }
    }

    pub fn with_mesh_minter(mut self, minter: Arc<dyn MeshKeyMinter>) -> Self {
        self.mesh_minter = Some(minter);
        self
    }

    pub fn with_registrar(mut self, registrar: Arc<dyn InstanceRegistrar>) -> Self {
        self.registrar = Some(registrar);
        self
    }
}

/// Strip secrets from a wizard state before returning it over the API.
/// Tokens and keys are needed server-side for later steps but must never be
/// echoed back to clients.
fn redacted(wizard: &WizardState) -> WizardState {
    let mut redacted = wizard.clone();
    redacted.context.api_token = None;
    redacted.context.ssh_private_key = None;
    redacted.context.ssh_password = None;
    redacted
}

/// Start new wizard deployment
pub async fn start_wizard(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Json(request): Json<StartWizardRequest>,
) -> Result<Json<WizardState>, StatusCode> {
    info!(
        "Starting new wizard deployment: provider={:?} user={}",
        request.provider, user.user_id
    );

    // Validate the credential/mode combination up front.
    match request.provider {
        SupportedProvider::Hetzner | SupportedProvider::DigitalOcean | SupportedProvider::Aws
            if request.api_token.is_none() =>
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        SupportedProvider::Manual
            if request.ssh_host.is_none()
                || request.ssh_username.is_none()
                || (request.ssh_private_key.is_none() && request.ssh_password.is_none()) =>
        {
            return Err(StatusCode::BAD_REQUEST);
        }
        _ => {}
    }

    // Create initial wizard state
    let mut wizard = WizardState::new();
    wizard.context.provider = Some(request.provider);
    wizard.context.instance_name = request.instance_name;
    wizard.context.region = request.region;
    wizard.context.instance_type = request.instance_type;
    wizard.context.storage_gb = request.storage_gb;

    if let Some(token) = &request.api_token {
        wizard.context.api_token = Some(token.clone());
        wizard.context.auth_method = Some(AuthMethod::ApiToken);
    }

    if let Some(host) = &request.ssh_host {
        wizard.context.ssh_host = Some(host.clone());
        wizard.context.ssh_port = request.ssh_port;
        wizard.context.ssh_username = request.ssh_username.clone();
        wizard.context.ssh_private_key = request.ssh_private_key.clone();
        wizard.context.ssh_password = request.ssh_password.clone();
        if wizard.context.auth_method.is_none() {
            wizard.context.auth_method = Some(if request.ssh_private_key.is_some() {
                AuthMethod::SshKey
            } else {
                AuthMethod::SshPassword
            });
        }
    }

    // Save initial checkpoint
    if let Err(e) = state.checkpoint_store.save(&user.user_id, &wizard).await {
        error!("Failed to save initial checkpoint: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Wizard created with deployment_id={}", wizard.deployment_id);
    Ok(Json(redacted(&wizard)))
}

/// List the authenticated user's wizard sessions (most recently updated first)
pub async fn list_wizards(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
) -> Result<Json<Vec<WizardState>>, StatusCode> {
    let ids = state
        .checkpoint_store
        .list(&user.user_id)
        .await
        .map_err(|e| {
            error!("Failed to list wizard checkpoints: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut wizards = Vec::with_capacity(ids.len());
    for id in ids {
        match state.checkpoint_store.load(&user.user_id, &id).await {
            Ok(Some(wizard)) => wizards.push(redacted(&wizard)),
            Ok(None) => {}
            Err(e) => {
                error!("Failed to load wizard {}: {}", id, e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }
    Ok(Json(wizards))
}

/// Get wizard state
pub async fn get_wizard_state(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<Json<WizardState>, StatusCode> {
    match state.checkpoint_store.load(&user.user_id, &deployment_id).await {
        Ok(Some(wizard)) => Ok(Json(redacted(&wizard))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Advance wizard to next step
pub async fn advance_wizard(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<Json<WizardState>, StatusCode> {
    info!("Advancing wizard: deployment_id={}", deployment_id);

    // Load current state
    let mut wizard = match state.checkpoint_store.load(&user.user_id, &deployment_id).await {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Check idempotency
    let idempotency_key = IdempotencyKey::for_step(&deployment_id, &format!("{:?}", wizard.current_step));
    if state.idempotency_store.is_duplicate(&idempotency_key.key).await {
        warn!("Duplicate request for step: {:?}", wizard.current_step);
        return Ok(Json(redacted(&wizard)));  // Return current state without advancing
    }

    // Execute current step
    match execute_step(&mut wizard, &user.user_id).await {
        Ok(_) => {
            // Save checkpoint
            if let Err(e) = state.checkpoint_store.save(&user.user_id, &wizard).await {
                error!("Failed to save checkpoint: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }

            // Mark idempotency key as completed
            state.idempotency_store.mark_completed(&idempotency_key.key).await;

            Ok(Json(redacted(&wizard)))
        }
        Err(e) => {
            error!("Step execution failed: {}", e);
            wizard.context.agent_guidance.push(format!("Error: {}", e));

            // Save failed state
            let _ = state.checkpoint_store.save(&user.user_id, &wizard).await;

            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Resume wizard after human checkpoint
pub async fn resume_wizard(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
    Json(request): Json<ResumeWizardRequest>,
) -> Result<Json<WizardState>, StatusCode> {
    info!("Resuming wizard after human action: deployment_id={}", deployment_id);

    // Load current state
    let mut wizard = match state.checkpoint_store.load(&user.user_id, &deployment_id).await {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Verify we're at a human checkpoint
    if !wizard.current_step.requires_human() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Record human action
    wizard.context.agent_guidance.push(format!("Human completed: {:?}", request.checkpoint_type));

    // Advance to next step
    if wizard.advance().is_err() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // Save checkpoint
    if let Err(e) = state.checkpoint_store.save(&user.user_id, &wizard).await {
        error!("Failed to save checkpoint: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(Json(redacted(&wizard)))
}

/// Cancel wizard deployment
pub async fn cancel_wizard(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    info!("Cancelling wizard: deployment_id={}", deployment_id);

    // Load current state
    let mut wizard = match state.checkpoint_store.load(&user.user_id, &deployment_id).await {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    wizard.cancel();

    // Save cancelled state
    if let Err(e) = state.checkpoint_store.save(&user.user_id, &wizard).await {
        error!("Failed to save cancelled state: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}

/// Delete a wizard checkpoint (terminal states only)
pub async fn delete_wizard(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let wizard = match state.checkpoint_store.load(&user.user_id, &deployment_id).await {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    if !wizard.current_step.is_terminal() {
        return Err(StatusCode::CONFLICT);
    }

    state
        .checkpoint_store
        .delete(&user.user_id, &deployment_id)
        .await
        .map_err(|e| {
            error!("Failed to delete wizard checkpoint: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Run the bootstrap step: mint a mesh preauth key, install gizzi-code over
/// SSH, join the tailnet, and register the instance in the platform registry.
///
/// Long-running by nature (release download + package install on the box);
/// the wizard session is checkpointed before and after the run.
pub async fn bootstrap_wizard(
    Extension(user): Extension<AuthenticatedUser>,
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Bootstrapping wizard deployment: {}", deployment_id);

    let mut wizard = state
        .checkpoint_store
        .load(&user.user_id, &deployment_id)
        .await
        .map_err(|e| {
            error!("Failed to load wizard state: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "checkpoint_load_failed" })),
            )
        })?
        .ok_or((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "wizard_not_found" })),
        ))?;

    if wizard.current_step != WizardStep::Bootstrap {
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": "wrong_step",
                "message": format!("wizard is at step {:?}, expected Bootstrap", wizard.current_step),
            })),
        ));
    }

    // Resolve the SSH target (uniform across manual and API provisioned modes).
    let ssh_host = wizard.context.ssh_host.clone().or_else(|| wizard.context.instance_ip.clone());
    let (host, username) = match (ssh_host, wizard.context.ssh_username.clone()) {
        (Some(host), Some(username)) => (host, username),
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "missing_ssh_target" })),
            ));
        }
    };
    let auth = match (
        wizard.context.ssh_private_key.clone(),
        wizard.context.ssh_password.clone(),
    ) {
        (Some(key), _) => SshAuth::PrivateKey(key),
        (None, Some(password)) => SshAuth::Password(password),
        (None, None) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "missing_ssh_credentials" })),
            ));
        }
    };

    // Mint the preauth key BEFORE the SSH run; it only ever lands in the
    // 0600 env file on the box.
    let minter = state.mesh_minter.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        Json(serde_json::json!({ "error": "mesh_not_configured" })),
    ))?;
    let mesh = minter.mint(&user.user_id).await.map_err(|e| {
        error!("Failed to mint mesh preauth key: {}", e);
        (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({ "error": "mesh_upstream_error" })),
        )
    })?;

    let instance_name = wizard
        .context
        .instance_name
        .clone()
        .unwrap_or_else(|| format!("allternit-{}", &wizard.deployment_id[..8]));

    let config = BootstrapConfig::new(
        host,
        wizard.context.ssh_port.unwrap_or(22),
        username,
        auth,
        instance_name.clone(),
        mesh,
    );

    match bootstrap::run_bootstrap(&config).await {
        Ok(result) => {
            let mesh_ip = result.mesh_ip.clone().ok_or((
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": "no_mesh_ip" })),
            ))?;
            let url = format!("http://{}:{}", mesh_ip, bootstrap::GIZZI_PORT);

            // Register the instance in the platform registry.
            let registrar = state.registrar.as_ref().ok_or((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "error": "registry_not_configured" })),
            ))?;
            if let Err(e) = registrar.register(&user.user_id, &instance_name, &url).await {
                error!("Failed to register gizzi instance: {}", e);
                wizard.context.agent_guidance.push(format!(
                    "Bootstrap succeeded but registry write failed: {}",
                    e
                ));
                let _ = state.checkpoint_store.save(&user.user_id, &wizard).await;
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "registry_write_failed" })),
                ));
            }

            // Mark complete.
            wizard.context.bootstrap_log = Some(tail(&result.log_output, 4000).to_string());
            wizard.context.verification_passed = Some(true);
            wizard.context.agent_guidance.push(format!(
                "Bootstrap complete; registered {} at {}",
                instance_name, url
            ));
            wizard.complete();
            if let Err(e) = state.checkpoint_store.save(&user.user_id, &wizard).await {
                error!("Failed to save completed wizard state: {}", e);
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "checkpoint_save_failed" })),
                ));
            }

            Ok(Json(serde_json::json!({
                "deployment_id": wizard.deployment_id,
                "status": "complete",
                "mesh_ip": mesh_ip,
                "instance_name": instance_name,
                "url": url,
                "wizard": redacted(&wizard),
            })))
        }
        Err(e) => {
            error!("Bootstrap failed for {}: {}", deployment_id, e);
            wizard.context.agent_guidance.push(format!("Bootstrap failed: {}", e));
            wizard.fail();
            let _ = state.checkpoint_store.save(&user.user_id, &wizard).await;
            Err((
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({
                    "error": "bootstrap_failed",
                    "message": e.message,
                    "recoverable": e.recoverable,
                })),
            ))
        }
    }
}

/// Execute current wizard step
async fn execute_step(wizard: &mut WizardState, user_id: &str) -> Result<(), String> {
    let current_step = wizard.current_step;

    match current_step {
        WizardStep::SelectProvider => {
            // Provider already selected in context
            wizard.advance().map_err(|e| e.to_string())?;
        }

        WizardStep::AgentAssistedSignup => {
            // Guide user to provider signup
            if let Some(provider) = wizard.context.provider {
                wizard.context.provider_signup_url = Some(
                    crate::guidance::AgentGuidanceOverlay::get_signup_url(provider).to_string()
                );
            }
            wizard.advance().map_err(|e| e.to_string())?;
        }

        WizardStep::ValidateCredentials => {
            // Validate credentials via preflight (API token or real SSH login)
            let checker = PreflightChecker::new();
            if let Some(ref token) = wizard.context.api_token {
                checker
                    .validate_api_token(wizard.context.provider, token)
                    .await
                    .map_err(|e| format!("Credential validation failed: {}", e))?;
                wizard.context.agent_guidance.push("Credentials validated successfully".to_string());
                wizard.advance().map_err(|e| e.to_string())?;
            } else if let Some(ref host) = wizard.context.ssh_host.clone() {
                // SSH mode - real connection + trivial command (`uname -a`)
                checker
                    .validate_ssh_connection(
                        host,
                        wizard.context.ssh_port.unwrap_or(22),
                        wizard.context.ssh_username.as_deref().unwrap_or("root"),
                        wizard.context.ssh_private_key.as_deref(),
                        wizard.context.ssh_password.as_deref(),
                    )
                    .await
                    .map_err(|e| format!("SSH validation failed: {}", e))?;
                wizard.context.agent_guidance.push("SSH connection validated successfully".to_string());
                wizard.advance().map_err(|e| e.to_string())?;
            } else {
                return Err("No credentials provided".to_string());
            }
        }

        WizardStep::Preflight => {
            // Run preflight checks
            let checker = PreflightChecker::new();
            let result = checker.run_all(&wizard.context).await;

            if result.passed {
                wizard.context.agent_guidance.push("Preflight checks passed".to_string());
                wizard.advance().map_err(|e| e.to_string())?;
            } else {
                let errors: Vec<String> = result.errors.iter().map(|e| format!("{}", e)).collect();
                return Err(format!("Preflight failed: {}", errors.join(", ")));
            }
        }

        WizardStep::Provisioning => {
            provision_server(wizard, user_id).await?;
        }

        WizardStep::Bootstrap => {
            // Bootstrap runs via the dedicated /bootstrap endpoint
            wizard.context.agent_guidance.push("Ready for bootstrap".to_string());
        }

        WizardStep::Verification => {
            // Verification result is recorded by the /bootstrap endpoint
            wizard.context.agent_guidance.push("Ready for verification".to_string());
        }

        WizardStep::Complete | WizardStep::Failed | WizardStep::Cancelled => {
            return Err("Cannot execute terminal step".to_string());
        }

        WizardStep::HumanPaymentCheckpoint |
        WizardStep::HumanVerificationCheckpoint |
        WizardStep::AwaitingHumanAction => {
            return Err("Waiting for human action".to_string());
        }

        WizardStep::EnterCredentials => {
            // Credentials already entered
            wizard.advance().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Provision a server through the provider driver (API mode), generating and
/// injecting a throwaway SSH keypair so the later bootstrap step can log in.
/// Manual mode skips straight to bootstrap with the user-supplied SSH target.
async fn provision_server(wizard: &mut WizardState, user_id: &str) -> Result<(), String> {
    let provider = wizard
        .context
        .provider
        .ok_or_else(|| "Provider not selected".to_string())?;

    if provider == SupportedProvider::Manual {
        // Manual mode - the user-supplied host is the target.
        wizard.context.instance_ip = wizard.context.ssh_host.clone();
        wizard.context.agent_guidance.push("Manual mode - skipping provisioning".to_string());
        wizard.advance().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let token = wizard
        .context
        .api_token
        .clone()
        .ok_or_else(|| "API token required for provisioning".to_string())?;
    let driver = driver_for(provider, token)
        .ok_or_else(|| format!("No automated driver for {:?} - use SSH mode", provider))?;

    // Throwaway keypair injected at create time; the private half stays in
    // the (encrypted) checkpoint for the bootstrap step.
    let keypair = allternit_cloud_ssh::SshKeyManager::new()
        .generate_keypair()
        .map_err(|e| format!("SSH keypair generation failed: {}", e))?;

    let (default_region, default_type, default_image) = match provider {
        SupportedProvider::Hetzner => ("fsn1", "cx21", "ubuntu-22.04"),
        SupportedProvider::DigitalOcean => ("nyc3", "s-1vcpu-2gb", "ubuntu-22-04-x64"),
        SupportedProvider::Aws => ("us-east-1", "t3.small", "ubuntu-24.04"),
        _ => unreachable!("non-API providers returned above"),
    };

    let request = CreateServerRequest {
        name: wizard.context.instance_name.clone().unwrap_or_else(|| "allternit-instance".to_string()),
        region: wizard.context.region.clone().unwrap_or_else(|| default_region.to_string()),
        instance_type: wizard.context.instance_type.clone().unwrap_or_else(|| default_type.to_string()),
        image: default_image.to_string(),
        ssh_keys: vec![keypair.public_key.clone()],
        storage_gb: wizard.context.storage_gb.unwrap_or(50),
        api_token: String::new(), // driver was constructed with the token
        owner_id: Some(user_id.to_string()),
    };

    let result = driver
        .create_server(&request)
        .await
        .map_err(|e| format!("Provisioning failed: {}", e.message))?;
    wizard.context.instance_id = Some(result.server_id.clone());
    wizard.context.agent_guidance.push(format!("Server created: {}", result.server_id));

    // Wait until the box is actually SSH-reachable, then record its IP and
    // the login the bootstrap step will use.
    driver
        .wait_for_ready(&result.server_id, PROVISION_READY_TIMEOUT)
        .await
        .map_err(|e| format!("Server did not become SSH-ready: {}", e.message))?;

    let ip = driver
        .get_server_ip(&result.server_id)
        .await
        .map_err(|e| format!("Failed to read server IP: {}", e.message))?
        .ok_or_else(|| "Provider reported no public IP".to_string())?;

    wizard.context.instance_ip = Some(ip.clone());
    wizard.context.ssh_host = Some(ip);
    wizard.context.ssh_port = Some(22);
    wizard.context.ssh_username = Some("root".to_string());
    wizard.context.ssh_private_key = Some(keypair.private_key);
    wizard.context.agent_guidance.push("Server is SSH-ready".to_string());

    wizard.advance().map_err(|e| e.to_string())?;
    Ok(())
}

/// Request types
#[derive(Debug, serde::Deserialize)]
pub struct StartWizardRequest {
    pub provider: crate::SupportedProvider,
    pub api_token: Option<String>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_username: Option<String>,
    pub ssh_private_key: Option<String>,
    pub ssh_password: Option<String>,
    pub instance_name: Option<String>,
    pub region: Option<String>,
    pub instance_type: Option<String>,
    pub storage_gb: Option<u32>,
}

#[derive(Debug, serde::Deserialize)]
pub struct ResumeWizardRequest {
    pub checkpoint_type: crate::HumanCheckpoint,
}

/// Last `n` chars of a string.
fn tail(value: &str, n: usize) -> &str {
    if value.len() <= n {
        value
    } else {
        &value[value.len() - n..]
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::checkpoint_store::InMemoryCheckpointStore;

    fn test_state() -> Arc<WizardAppState> {
        Arc::new(WizardAppState::new(Arc::new(InMemoryCheckpointStore::new())))
    }

    fn user(id: &str) -> AuthenticatedUser {
        AuthenticatedUser { user_id: id.to_string() }
    }

    #[test]
    fn redacted_strips_all_secrets() {
        let mut wizard = WizardState::new();
        wizard.context.api_token = Some("token".to_string());
        wizard.context.ssh_private_key = Some("key".to_string());
        wizard.context.ssh_password = Some("pass".to_string());

        let redacted = redacted(&wizard);
        assert!(redacted.context.api_token.is_none());
        assert!(redacted.context.ssh_private_key.is_none());
        assert!(redacted.context.ssh_password.is_none());
        // Original must keep its secrets for later steps.
        assert!(wizard.context.api_token.is_some());
    }

    #[tokio::test]
    async fn wizard_sessions_are_isolated_per_user() {
        let state = test_state();

        let created = start_wizard(
            Extension(user("user_a")),
            State(state.clone()),
            Json(StartWizardRequest {
                provider: SupportedProvider::Manual,
                api_token: None,
                ssh_host: Some("203.0.113.5".to_string()),
                ssh_port: Some(22),
                ssh_username: Some("root".to_string()),
                ssh_private_key: Some("key".to_string()),
                ssh_password: None,
                instance_name: None,
                region: None,
                instance_type: None,
                storage_gb: None,
            }),
        )
        .await
        .unwrap();
        let deployment_id = created.deployment_id.clone();

        // The same deployment id is invisible to another user.
        let other = get_wizard_state(
            Extension(user("user_b")),
            State(state.clone()),
            Path(deployment_id.clone()),
        )
        .await;
        assert!(matches!(other, Err(StatusCode::NOT_FOUND)));

        let list_a = list_wizards(Extension(user("user_a")), State(state.clone()))
            .await
            .unwrap();
        assert_eq!(list_a.len(), 1);
        let list_b = list_wizards(Extension(user("user_b")), State(state))
            .await
            .unwrap();
        assert!(list_b.is_empty());
    }

    #[tokio::test]
    async fn start_wizard_rejects_bad_credential_combinations() {
        let state = test_state();
        let base = StartWizardRequest {
            provider: SupportedProvider::Hetzner,
            api_token: None, // API-mode provider without a token
            ssh_host: None,
            ssh_port: None,
            ssh_username: None,
            ssh_private_key: None,
            ssh_password: None,
            instance_name: None,
            region: None,
            instance_type: None,
            storage_gb: None,
        };
        let result = start_wizard(Extension(user("user_a")), State(state), Json(base)).await;
        assert!(matches!(result, Err(StatusCode::BAD_REQUEST)));
    }

    #[tokio::test]
    async fn bootstrap_requires_bootstrap_step() {
        let state = test_state();
        let mut wizard = WizardState::new();
        wizard.deployment_id = "dep-1".to_string();
        // Fresh wizard sits at SelectProvider, not Bootstrap.
        state
            .checkpoint_store
            .save("user_a", &wizard)
            .await
            .unwrap();

        let result = bootstrap_wizard(
            Extension(user("user_a")),
            State(state),
            Path("dep-1".to_string()),
        )
        .await;
        let (status, _) = result.unwrap_err();
        assert_eq!(status, StatusCode::CONFLICT);
    }

    #[tokio::test]
    async fn bootstrap_requires_mesh_minter() {
        let state = test_state(); // no minter wired
        let mut wizard = WizardState::new();
        wizard.deployment_id = "dep-2".to_string();
        wizard.current_step = WizardStep::Bootstrap;
        wizard.context.ssh_host = Some("203.0.113.5".to_string());
        wizard.context.ssh_username = Some("root".to_string());
        wizard.context.ssh_private_key = Some("key".to_string());
        state
            .checkpoint_store
            .save("user_a", &wizard)
            .await
            .unwrap();

        let result = bootstrap_wizard(
            Extension(user("user_a")),
            State(state),
            Path("dep-2".to_string()),
        )
        .await;
        let (status, body) = result.unwrap_err();
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["error"], "mesh_not_configured");
    }

    #[tokio::test]
    async fn cancel_and_delete_terminal_wizard() {
        let state = test_state();
        let mut wizard = WizardState::new();
        wizard.deployment_id = "dep-3".to_string();
        state
            .checkpoint_store
            .save("user_a", &wizard)
            .await
            .unwrap();

        // Not terminal yet: delete must conflict.
        let result = delete_wizard(
            Extension(user("user_a")),
            State(state.clone()),
            Path("dep-3".to_string()),
        )
        .await;
        assert!(matches!(result, Err(StatusCode::CONFLICT)));

        cancel_wizard(
            Extension(user("user_a")),
            State(state.clone()),
            Path("dep-3".to_string()),
        )
        .await
        .unwrap();

        delete_wizard(
            Extension(user("user_a")),
            State(state),
            Path("dep-3".to_string()),
        )
        .await
        .unwrap();
    }
}

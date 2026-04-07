//! Wizard API Handlers
//!
//! Request handlers for the deployment wizard with checkpoint persistence.

use crate::state_machine::{WizardState, WizardStep, WizardContext};
use crate::checkpoint_store::{CheckpointStore, IdempotencyKey};
use crate::provider::{ProviderDriver, HetznerDriver, DigitalOceanDriver, CreateServerRequest};
use crate::preflight::PreflightChecker;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use tracing::{info, error, warn};

/// Wizard application state
pub struct WizardAppState {
    pub checkpoint_store: Arc<dyn CheckpointStore>,
    pub idempotency_store: Arc<crate::checkpoint_store::IdempotencyStore>,
}

impl WizardAppState {
    pub fn new(checkpoint_store: Arc<dyn CheckpointStore>) -> Self {
        Self {
            checkpoint_store,
            idempotency_store: Arc::new(crate::checkpoint_store::IdempotencyStore::new()),
        }
    }
}

/// Start new wizard deployment
pub async fn start_wizard(
    State(state): State<Arc<WizardAppState>>,
    Json(request): Json<StartWizardRequest>,
) -> Result<Json<WizardState>, StatusCode> {
    info!("Starting new wizard deployment: provider={:?}", request.provider);

    // Create initial wizard state
    let mut wizard = WizardState::new();
    wizard.context.provider = Some(request.provider);
    
    if let Some(token) = &request.api_token {
        wizard.context.api_token = Some(token.clone());
    }
    
    if let Some(host) = &request.ssh_host {
        wizard.context.ssh_host = Some(host.clone());
        wizard.context.ssh_port = request.ssh_port;
        wizard.context.ssh_username = request.ssh_username.clone();
        wizard.context.ssh_private_key = request.ssh_private_key.clone();
    }

    // Save initial checkpoint
    if let Err(e) = state.checkpoint_store.save(&wizard).await {
        error!("Failed to save initial checkpoint: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Wizard created with deployment_id={}", wizard.deployment_id);
    Ok(Json(wizard))
}

/// Get wizard state
pub async fn get_wizard_state(
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<Json<WizardState>, StatusCode> {
    match state.checkpoint_store.load(&deployment_id).await {
        Ok(Some(wizard)) => Ok(Json(wizard)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Advance wizard to next step
pub async fn advance_wizard(
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<Json<WizardState>, StatusCode> {
    info!("Advancing wizard: deployment_id={}", deployment_id);

    // Load current state
    let mut wizard = match state.checkpoint_store.load(&deployment_id).await {
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
        return Ok(Json(wizard));  // Return current state without advancing
    }

    // Execute current step
    match execute_step(&mut wizard).await {
        Ok(_) => {
            // Save checkpoint
            if let Err(e) = state.checkpoint_store.save(&wizard).await {
                error!("Failed to save checkpoint: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
            
            // Mark idempotency key as completed
            state.idempotency_store.mark_completed(&idempotency_key.key).await;
            
            Ok(Json(wizard))
        }
        Err(e) => {
            error!("Step execution failed: {}", e);
            wizard.context.agent_guidance.push(format!("Error: {}", e));
            
            // Save failed state
            let _ = state.checkpoint_store.save(&wizard).await;
            
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Resume wizard after human checkpoint
pub async fn resume_wizard(
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
    Json(request): Json<ResumeWizardRequest>,
) -> Result<Json<WizardState>, StatusCode> {
    info!("Resuming wizard after human action: deployment_id={}", deployment_id);

    // Load current state
    let mut wizard = match state.checkpoint_store.load(&deployment_id).await {
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
    if let Err(e) = state.checkpoint_store.save(&wizard).await {
        error!("Failed to save checkpoint: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(Json(wizard))
}

/// Cancel wizard deployment
pub async fn cancel_wizard(
    State(state): State<Arc<WizardAppState>>,
    Path(deployment_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    info!("Cancelling wizard: deployment_id={}", deployment_id);

    // Load current state
    let mut wizard = match state.checkpoint_store.load(&deployment_id).await {
        Ok(Some(w)) => w,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to load wizard state: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    wizard.cancel();

    // Save cancelled state
    if let Err(e) = state.checkpoint_store.save(&wizard).await {
        error!("Failed to save cancelled state: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    Ok(StatusCode::OK)
}

/// Execute current wizard step
async fn execute_step(wizard: &mut WizardState) -> Result<(), String> {
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
            // Validate credentials via preflight
            if let Some(ref token) = wizard.context.api_token {
                let checker = PreflightChecker::new();
                let result = checker.validate_api_token(
                    wizard.context.provider,
                    token
                ).await;
                
                match result {
                    Ok(_) => {
                        wizard.context.agent_guidance.push("Credentials validated successfully".to_string());
                        wizard.advance().map_err(|e| e.to_string())?;
                    }
                    Err(e) => {
                        return Err(format!("Credential validation failed: {}", e));
                    }
                }
            } else if wizard.context.ssh_host.is_some() {
                // SSH mode - validate connection
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
            // Provision server via provider API
            if let Some(provider) = wizard.context.provider {
                match provider {
                    crate::SupportedProvider::Hetzner => {
                        if let Some(ref token) = wizard.context.api_token {
                            let driver = HetznerDriver::new(token.clone());
                            
                            let request = CreateServerRequest {
                                name: wizard.context.instance_name.clone().unwrap_or_else(|| "a2r-instance".to_string()),
                                region: wizard.context.region.clone().unwrap_or_else(|| "fsn1".to_string()),
                                instance_type: wizard.context.instance_type.clone().unwrap_or_else(|| "cx21".to_string()),
                                image: "ubuntu-22.04".to_string(),
                                ssh_keys: vec![],  // Will be generated
                                storage_gb: wizard.context.storage_gb.unwrap_or(100),
                                api_token: token.clone(),
                            };
                            
                            match driver.create_server(&request).await {
                                Ok(result) => {
                                    wizard.context.instance_id = Some(result.server_id);
                                    wizard.context.agent_guidance.push("Server created".to_string());
                                    wizard.advance().map_err(|e| e.to_string())?;
                                }
                                Err(e) => {
                                    return Err(format!("Provisioning failed: {}", e.message));
                                }
                            }
                        } else {
                            return Err("API token required for provisioning".to_string());
                        }
                    }
                    
                    crate::SupportedProvider::DigitalOcean => {
                        if let Some(ref token) = wizard.context.api_token {
                            let driver = DigitalOceanDriver::new(token.clone());
                            
                            let request = CreateServerRequest {
                                name: wizard.context.instance_name.clone().unwrap_or_else(|| "a2r-instance".to_string()),
                                region: wizard.context.region.clone().unwrap_or_else(|| "nyc3".to_string()),
                                instance_type: wizard.context.instance_type.clone().unwrap_or_else(|| "s-1vcpu-2gb".to_string()),
                                image: "ubuntu-22-04-x64".to_string(),
                                ssh_keys: vec![],
                                storage_gb: wizard.context.storage_gb.unwrap_or(50),
                                api_token: token.clone(),
                            };
                            
                            match driver.create_server(&request).await {
                                Ok(result) => {
                                    wizard.context.instance_id = Some(result.server_id);
                                    wizard.context.agent_guidance.push("Droplet created".to_string());
                                    wizard.advance().map_err(|e| e.to_string())?;
                                }
                                Err(e) => {
                                    return Err(format!("Provisioning failed: {}", e.message));
                                }
                            }
                        } else {
                            return Err("API token required for provisioning".to_string());
                        }
                    }
                    
                    crate::SupportedProvider::Manual => {
                        // Manual mode - skip provisioning, go straight to bootstrap
                        wizard.context.agent_guidance.push("Manual mode - skipping provisioning".to_string());
                        wizard.advance().map_err(|e| e.to_string())?;
                    }
                    
                    _ => {
                        return Err("Unsupported provider".to_string());
                    }
                }
            } else {
                return Err("Provider not selected".to_string());
            }
        }
        
        WizardStep::Bootstrap => {
            // Bootstrap is handled by separate endpoint
            wizard.context.agent_guidance.push("Ready for bootstrap".to_string());
        }
        
        WizardStep::Verification => {
            // Verification is handled by separate endpoint
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

/// Request types
#[derive(Debug, serde::Deserialize)]
pub struct StartWizardRequest {
    pub provider: crate::SupportedProvider,
    pub api_token: Option<String>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_username: Option<String>,
    pub ssh_private_key: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct ResumeWizardRequest {
    pub checkpoint_type: crate::HumanCheckpoint,
}

//! Application state module
//! 
//! This module defines the shared state types to avoid circular dependencies.
//! All state types are defined here, and the implementation modules
/// use these types.

use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

// ============================================================================
// VM Session Types
// ============================================================================

/// VM session status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmSessionStatus {
    Creating,
    Running,
    Destroyed,
}

/// Live VM session record
#[derive(Debug, Clone, Serialize)]
pub struct VmSession {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub workdir: String,
    pub workspace_path: String,
    pub status: VmSessionStatus,
    #[serde(skip)]
    pub handle_id: Option<String>,
    pub git_cloned: bool,
}

/// VM Session store type
pub type VmSessionStore = Arc<RwLock<HashMap<String, VmSession>>>;

// ============================================================================
// RailsState (defined here to avoid circular deps)
// ============================================================================

use allternit_agent_system_rails::{
    ContextPackStore, Gate, Index, Leases, Ledger, Mail, ReceiptStore, Vault, WorkOps,
};

/// Rails service state shared across handlers
#[derive(Clone)]
pub struct RailsState {
    pub ledger: Arc<Ledger>,
    pub gate: Arc<Gate>,
    pub leases: Arc<Leases>,
    pub mail: Arc<Mail>,
    pub vault: Arc<Vault>,
    pub index: Arc<Index>,
    pub receipts: Arc<ReceiptStore>,
    pub work_ops: Arc<WorkOps>,
    pub context_packs: Arc<ContextPackStore>,
}

impl RailsState {
    pub async fn new(root_dir: std::path::PathBuf) -> anyhow::Result<Self> {
        use tracing::info;
        use allternit_agent_system_rails::{
            ContextPackStoreOptions, GateOptions, IndexOptions, LeasesOptions,
            LedgerOptions, MailOptions, ReceiptStoreOptions, VaultOptions,
        };
        
        info!("Initializing Rails service state...");

        // Initialize Ledger
        let ledger = Arc::new(Ledger::new(LedgerOptions {
            root_dir: Some(root_dir.clone()),
            ledger_dir: Some(std::path::PathBuf::from(".allternit/ledger")),
        }));

        // Initialize Leases
        let leases = Arc::new(
            Leases::new(LeasesOptions {
                root_dir: Some(root_dir.clone()),
                leases_dir: Some(std::path::PathBuf::from(".allternit/leases")),
                event_sink: Some(ledger.clone()),
                actor_id: Some("api".to_string()),
                auto_renewal_enabled: true,
                auto_renewal_threshold_seconds: 300,
                auto_renewal_interval_seconds: 60,
                auto_renewal_extend_seconds: 600,
            })
            .await?,
        );

        // Initialize Receipts
        let receipts = Arc::new(ReceiptStore::new(ReceiptStoreOptions {
            root_dir: Some(root_dir.clone()),
            receipts_dir: Some(std::path::PathBuf::from(".allternit/receipts")),
            blobs_dir: Some(std::path::PathBuf::from(".allternit/blobs")),
        })?);

        // Initialize Context Packs
        let context_packs = Arc::new(ContextPackStore::new(ContextPackStoreOptions {
            root_dir: Some(root_dir.clone()),
            context_packs_dir: Some(std::path::PathBuf::from(".allternit/context-packs")),
        })?);

        // Initialize Index
        let index = Arc::new(
            Index::new(IndexOptions {
                root_dir: Some(root_dir.clone()),
                index_dir: Some(std::path::PathBuf::from(".allternit/index")),
            })
            .await?,
        );

        // Initialize Vault
        let vault = Arc::new(Vault::new(VaultOptions {
            root_dir: Some(root_dir.clone()),
            ledger: ledger.clone(),
            actor_id: Some("api".to_string()),
        }));

        // Initialize OAuthVault
        let oauth_vault = Arc::new(allternit_agent_system_rails::vault::OAuthVault::new(root_dir.clone()));

        // Initialize Gate
        let gate = Arc::new(Gate::new(GateOptions {
            ledger: ledger.clone(),
            leases: leases.clone(),
            receipts: receipts.clone(),
            index: Some(index.clone()),
            vault: Some(vault.clone()),
            oauth_vault: Some(oauth_vault.clone()),
            root_dir: Some(root_dir.clone()),
            actor_id: Some("api".to_string()),
            strict_provenance: None,
            visual_provider: None,
            visual_config: None,
        }));

        // Initialize Mail
        let mail = Arc::new(Mail::new(MailOptions {
            root_dir: Some(root_dir.clone()),
            ledger: ledger.clone(),
            actor_id: Some("api".to_string()),
            actor_type: Some(allternit_agent_system_rails::ActorType::Agent),
        }));

        // Initialize WorkOps
        let work_ops = Arc::new(WorkOps::new(
            ledger.clone(),
            Some("api".to_string()),
            Some(allternit_agent_system_rails::ActorType::Agent),
        ));

        info!("Rails service state initialized successfully");

        Ok(Self {
            ledger,
            gate,
            leases,
            mail,
            vault,
            index,
            receipts,
            work_ops,
            context_packs,
        })
    }
}

// ============================================================================
// AppState
// ============================================================================

/// Application state shared across all routes
pub struct AppState {
    /// VM execution driver (Firecracker on Linux, Apple VF on macOS)
    pub vm_driver: Option<Box<dyn allternit_driver_interface::ExecutionDriver>>,
    /// Rails service state (Ledger, Gate, Leases, etc.)
    pub rails: RailsState,
    /// Persistent VM sessions
    pub vm_sessions: VmSessionStore,
}

impl AppState {
    /// Create new AppState
    pub fn new(
        vm_driver: Option<Box<dyn allternit_driver_interface::ExecutionDriver>>,
        rails: RailsState,
        vm_sessions: VmSessionStore,
    ) -> Self {
        Self {
            vm_driver,
            rails,
            vm_sessions,
        }
    }
}

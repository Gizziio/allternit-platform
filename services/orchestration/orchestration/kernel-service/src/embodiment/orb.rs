use serde::{Serialize, Deserialize};
use tokio::sync::broadcast;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrbMode {
    Idle,       // Resting state (slow breathe)
    Listening,  // Active input (expand/contract)
    Thinking,   // Processing (rapid spin/pulse)
    Speaking,   // Output (audio-reactive)
    Execute,    // Tool execution (steady)
    AwaitingAuth, // Requires user confirmation (tactile)
    Warning,    // Risk/Confirmation needed
    Error,      // Something went wrong
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskLevel {
    Safe,    // Read-only / Low impact
    Caution, // Write / Moderate impact
    Critical // Exec / High impact
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrbState {
    pub mode: OrbMode,
    pub intensity: f32, // 0.0 to 1.0
    pub primary_color: String, // Hex
    pub secondary_color: String, // Hex
    pub message: Option<String>,
    pub confidence: f32, // 0.0 to 1.0
    pub risk_level: RiskLevel,
    pub auth_id: Option<String>,
}

impl Default for OrbState {
    fn default() -> Self {
        Self {
            mode: OrbMode::Idle,
            intensity: 0.1,
            primary_color: "#FFFFFF".to_string(),
            secondary_color: "#888888".to_string(),
            message: None,
            confidence: 1.0,
            risk_level: RiskLevel::Safe,
            auth_id: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PendingAuth {
    pub id: String,
    pub tool_id: String,
    pub parameters: serde_json::Value,
    pub description: String,
}

#[derive(Debug)]
pub struct OrbManager {
    tx: broadcast::Sender<OrbState>,
    current_state: Arc<tokio::sync::RwLock<OrbState>>,
    pub pending_auth: Arc<tokio::sync::Mutex<Option<PendingAuth>>>,
}

impl OrbManager {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            tx,
            current_state: Arc::new(tokio::sync::RwLock::new(OrbState::default())),
            pending_auth: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<OrbState> {
        self.tx.subscribe()
    }

    pub async fn update_state(&self, new_state: OrbState) {
        {
            let mut state = self.current_state.write().await;
            *state = new_state.clone();
        }
        // Ignore error if no listeners
        let _ = self.tx.send(new_state);
    }

    pub async fn get_current_state(&self) -> OrbState {
        self.current_state.read().await.clone()
    }

    // Helpers to quickly set modes
    pub async fn set_thinking(&self) {
        self.update_state(OrbState {
            mode: OrbMode::Thinking,
            intensity: 0.8,
            primary_color: "#00AABB".to_string(), // Cyan
            secondary_color: "#FFFFFF".to_string(),
            message: Some("Processing...".to_string()),
            confidence: 1.0,
            risk_level: RiskLevel::Safe,
            auth_id: None,
        }).await;
    }

    pub async fn set_idle(&self) {
        self.update_state(OrbState::default()).await;
    }
    
    pub async fn set_listening(&self) {
         self.update_state(OrbState {
            mode: OrbMode::Listening,
            intensity: 0.5,
            primary_color: "#00FF00".to_string(), // Green
            secondary_color: "#AAFFAA".to_string(),
            message: Some("Listening...".to_string()),
            confidence: 1.0,
            risk_level: RiskLevel::Safe,
            auth_id: None,
        }).await;
    }

    pub async fn request_auth(&self, tool_id: &str, params: &serde_json::Value, description: &str) -> String {
        let auth_id = uuid::Uuid::new_v4().to_string();
        let pending = PendingAuth {
            id: auth_id.clone(),
            tool_id: tool_id.to_string(),
            parameters: params.clone(),
            description: description.to_string(),
        };

        {
            let mut lock = self.pending_auth.lock().await;
            *lock = Some(pending);
        }

        self.update_state(OrbState {
            mode: OrbMode::AwaitingAuth,
            intensity: 1.0,
            primary_color: "#FF5500".to_string(), // Orange/Red
            secondary_color: "#550000".to_string(),
            message: Some(format!("Authorize: {}", description)),
            confidence: 1.0,
            risk_level: RiskLevel::Caution, // Or Critical
            auth_id: Some(auth_id.clone()),
        }).await;

        auth_id
    }

    pub async fn resolve_auth(&self, auth_id: &str) -> Option<PendingAuth> {
        let mut lock = self.pending_auth.lock().await;
        if let Some(pending) = &*lock {
            if pending.id == auth_id {
                let task = pending.clone();
                *lock = None;
                self.set_thinking().await; // Transition to thinking while executing
                return Some(task);
            }
        }
        None
    }
}

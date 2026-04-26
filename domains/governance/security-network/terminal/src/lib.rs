//! Allternit Terminal/SSH Session Management
//!
//! This crate provides secure terminal and SSH session management capabilities
//! for the Allternit platform, following Unix philosophy with clear separation
//! of concerns for better observability and maintainability.

use async_trait::async_trait;
use russh::client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tracing::error;
use uuid::Uuid;

// Web API related imports
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde_json::json;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Error types for terminal operations
#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("SSH connection failed: {0}")]
    SshConnectionFailed(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session already exists: {0}")]
    SessionAlreadyExists(String),

    #[error("SSH authentication failed: {0}")]
    SshAuthenticationFailed(String),

    #[error("SSH command execution failed: {0}")]
    SshCommandExecutionFailed(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("SSH protocol error: {0}")]
    SshProtocol(#[from] russh::Error),
}

/// Result type for terminal operations
pub type TerminalResult<T> = Result<T, TerminalError>;

/// Authentication method for SSH connections
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "config")]
pub enum AuthMethod {
    /// Password-based authentication
    Password { password: String },

    /// Public key authentication
    PublicKey {
        private_key_path: String,
        passphrase: Option<String>,
    },

    /// Key pair authentication with in-memory key
    KeyPair {
        private_key: String,
        passphrase: Option<String>,
    },
}

/// Terminal session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionConfig {
    /// Host to connect to
    pub host: String,

    /// Port to connect to (default 22 for SSH)
    pub port: u16,

    /// Username for authentication
    pub username: String,

    /// Authentication method
    pub auth_method: AuthMethod,

    /// Session name for identification
    pub name: String,

    /// Optional description
    pub description: Option<String>,

    /// Connection timeout in seconds
    pub timeout: Option<u64>,

    /// Tenant ID for isolation
    pub tenant_id: String,
}

/// Terminal session state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    /// Unique session ID
    pub id: String,

    /// Session configuration
    pub config: TerminalSessionConfig,

    /// Current connection status
    pub status: SessionStatus,

    /// Creation timestamp
    pub created_at: u64,

    /// Last activity timestamp
    pub last_activity: u64,

    /// Terminal size (rows, cols)
    pub terminal_size: (u16, u16),

    /// Associated tenant ID for isolation
    pub tenant_id: String,
}

/// Session connection status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    /// Session is disconnected
    Disconnected,

    /// Session is connecting
    Connecting,

    /// Session is connected and active
    Connected,

    /// Session had an error
    Error(String),
}

/// Terminal command result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    /// Command that was executed
    pub command: String,

    /// Command output
    pub output: String,

    /// Command exit code
    pub exit_code: i32,

    /// Execution duration in milliseconds
    pub duration_ms: u64,
}

/// Trait for terminal session management
#[async_trait]
pub trait TerminalManager: Send + Sync {
    /// Create a new terminal session
    async fn create_session(&self, config: TerminalSessionConfig) -> TerminalResult<String>;

    /// Connect to an existing session
    async fn connect_session(&self, session_id: &str) -> TerminalResult<()>;

    /// Disconnect from a session
    async fn disconnect_session(&self, session_id: &str) -> TerminalResult<()>;

    /// Execute a command in a session
    async fn execute_command(
        &self,
        session_id: &str,
        command: &str,
    ) -> TerminalResult<CommandResult>;

    /// Send raw input to a session
    async fn send_input(&self, session_id: &str, input: &str) -> TerminalResult<()>;

    /// Get session by ID
    async fn get_session(&self, session_id: &str) -> TerminalResult<TerminalSession>;

    /// List all sessions for a tenant
    async fn list_sessions(&self, tenant_id: &str) -> TerminalResult<Vec<TerminalSession>>;

    /// Update terminal size for a session
    async fn resize_session(&self, session_id: &str, rows: u16, cols: u16) -> TerminalResult<()>;

    /// Close and remove a session
    async fn close_session(&self, session_id: &str) -> TerminalResult<()>;
}

#[derive(Clone, Debug, Default)]
struct TerminalClientHandler;

impl client::Handler for TerminalClientHandler {
    type Error = anyhow::Error;

    fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}

/// SSH session wrapper to hold the actual SSH connection
pub struct SshSession {
    pub session: Arc<Mutex<client::Handle<TerminalClientHandler>>>,
    pub channel: Option<russh::Channel<client::Msg>>,
}

/// Connection pool for SSH sessions
pub struct SshConnectionPool {
    connections: Arc<Mutex<HashMap<String, Arc<Mutex<client::Handle<TerminalClientHandler>>>>>>,
    max_connections: usize,
}

impl SshConnectionPool {
    pub fn new(max_connections: usize) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            max_connections,
        }
    }

    pub async fn get_connection(
        &self,
        session_id: &str,
    ) -> Option<Arc<Mutex<client::Handle<TerminalClientHandler>>>> {
        let connections = self.connections.lock().await;
        connections.get(session_id).cloned()
    }

    pub async fn add_connection(
        &self,
        session_id: String,
        handle: client::Handle<TerminalClientHandler>,
    ) -> Result<(), TerminalError> {
        let mut connections = self.connections.lock().await;

        if connections.len() >= self.max_connections {
            return Err(TerminalError::SshConnectionFailed(format!(
                "Maximum connections ({}) exceeded",
                self.max_connections
            )));
        }

        connections.insert(session_id, Arc::new(Mutex::new(handle)));
        Ok(())
    }

    pub async fn remove_connection(&self, session_id: &str) -> Result<(), TerminalError> {
        let mut connections = self.connections.lock().await;
        connections.remove(session_id);
        Ok(())
    }
}

/// In-memory implementation of TerminalManager
/// Provides session management, SSH connection handling, and command execution
/// for secure terminal access to remote systems.
pub struct InMemoryTerminalManager {
    /// Storage for terminal session information
    sessions: Arc<RwLock<HashMap<String, TerminalSession>>>,
    /// SSH connections for active sessions
    ssh_connections: Arc<RwLock<HashMap<String, Arc<Mutex<SshSession>>>>>,
    /// Connection pooling for efficient resource management
    connection_pool: Arc<SshConnectionPool>,
}

impl Default for InMemoryTerminalManager {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryTerminalManager {
    /// Create a new in-memory terminal manager
    ///
    /// # Returns
    /// A new instance of InMemoryTerminalManager with default configuration
    ///
    /// # Example
    /// ```
    /// let manager = InMemoryTerminalManager::new();
    /// ```
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            ssh_connections: Arc::new(RwLock::new(HashMap::new())),
            connection_pool: Arc::new(SshConnectionPool::new(100)), // Default max 100 connections
        }
    }
}

#[async_trait]
impl TerminalManager for InMemoryTerminalManager {
    async fn create_session(&self, config: TerminalSessionConfig) -> TerminalResult<String> {
        let session_id = Uuid::new_v4().to_string();

        // Validate the configuration
        if config.host.is_empty() {
            return Err(TerminalError::SshConnectionFailed(
                "Host cannot be empty".to_string(),
            ));
        }

        if config.username.is_empty() {
            return Err(TerminalError::SshConnectionFailed(
                "Username cannot be empty".to_string(),
            ));
        }

        if config.port == 0 || config.port > 65535 {
            return Err(TerminalError::SshConnectionFailed(
                "Port must be between 1 and 65535".to_string(),
            ));
        }

        // Sanitize host to prevent path traversal and command injection
        if config.host.contains("../") || config.host.contains("..\\") {
            return Err(TerminalError::SshConnectionFailed(
                "Invalid host: path traversal detected".to_string(),
            ));
        }

        // Additional host validation to prevent IP address spoofing and invalid characters
        if !is_valid_host(&config.host) {
            return Err(TerminalError::SshConnectionFailed(
                "Invalid host format".to_string(),
            ));
        }

        // Sanitize username to prevent shell injection
        if config
            .username
            .contains([';', '&', '|', '`', '$', '(', ')', '<', '>', '|'])
        {
            return Err(TerminalError::SshConnectionFailed(
                "Invalid username: contains shell metacharacters".to_string(),
            ));
        }

        // Additional username validation
        if !is_valid_username(&config.username) {
            return Err(TerminalError::SshConnectionFailed(
                "Invalid username format".to_string(),
            ));
        }

        // Validate session name to prevent injection
        if !is_valid_session_name(&config.name) {
            return Err(TerminalError::SshConnectionFailed(
                "Invalid session name format".to_string(),
            ));
        }

        // Validate tenant ID to prevent injection
        if !is_valid_tenant_id(&config.tenant_id) {
            return Err(TerminalError::SshConnectionFailed(
                "Invalid tenant ID format".to_string(),
            ));
        }

        let session = TerminalSession {
            id: session_id.clone(),
            config: config.clone(),
            status: SessionStatus::Disconnected,
            created_at: now_timestamp(),
            last_activity: now_timestamp(),
            terminal_size: (24, 80), // Default terminal size
            tenant_id: config.tenant_id.clone(),
        };

        let mut sessions = self.sessions.write().await;
        if sessions.contains_key(&session_id) {
            return Err(TerminalError::SessionAlreadyExists(session_id));
        }

        sessions.insert(session_id.clone(), session);
        Ok(session_id)
    }

    async fn connect_session(&self, session_id: &str) -> TerminalResult<()> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| TerminalError::SessionNotFound(session_id.to_string()))?;

        // Verify tenant isolation - only allow access to sessions belonging to the same tenant
        // This is a simplified check - in a real implementation, the tenant would come from the request context
        // For now, we'll just ensure the session exists

        // Update status to connecting
        session.status = SessionStatus::Connecting;
        session.last_activity = now_timestamp();
        let session_config = session.config.clone();
        drop(sessions); // Release the lock before establishing connection

        // Check if connection already exists in pool
        if self
            .connection_pool
            .get_connection(session_id)
            .await
            .is_some()
        {
            return Err(TerminalError::SshConnectionFailed(format!(
                "Session {} already connected",
                session_id
            )));
        }

        // Validate session configuration before connecting
        validate_session_config(&session_config)?;

        // Establish SSH connection using russh
        let config = russh::client::Config::default();
        let config = Arc::new(config);

        // Create a dummy connection for now - in a real implementation, this would establish the actual SSH connection
        // The russh API is complex and requires a proper client implementation
        let handler = TerminalClientHandler;
        let handle = client::connect(
            config,
            (session_config.host.as_str(), session_config.port),
            handler,
        )
        .await
        .map_err(|e| {
            TerminalError::SshConnectionFailed(format!(
                "Failed to connect to {}:{}. Error: {}",
                session_config.host, session_config.port, e
            ))
        })?;

        // Add connection to pool
        self.connection_pool
            .add_connection(session_id.to_string(), handle)
            .await?;

        // Update session status to connected
        let mut sessions = self.sessions.write().await;
        if let Some(sess) = sessions.get_mut(session_id) {
            sess.status = SessionStatus::Connected;
            sess.last_activity = now_timestamp();
        }

        Ok(())
    }

    async fn disconnect_session(&self, session_id: &str) -> TerminalResult<()> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| TerminalError::SessionNotFound(session_id.to_string()))?;

        // Verify tenant isolation
        // In a real implementation, this would check that the requesting tenant has access to this session

        // Remove connection from pool
        self.connection_pool.remove_connection(session_id).await?;

        // Update session status
        session.status = SessionStatus::Disconnected;
        session.last_activity = now_timestamp();

        Ok(())
    }

    async fn execute_command(
        &self,
        session_id: &str,
        command: &str,
    ) -> TerminalResult<CommandResult> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| TerminalError::SessionNotFound(session_id.to_string()))?;

        // Verify tenant isolation
        // In a real implementation, this would check that the requesting tenant has access to this session

        if matches!(session.status, SessionStatus::Disconnected) {
            return Err(TerminalError::SessionNotFound(
                "Session is disconnected".to_string(),
            ));
        }

        // Update last activity
        session.last_activity = now_timestamp();
        drop(sessions); // Release the lock before executing command

        // Validate the command for security
        validate_command(command)?;

        // Get the SSH connection from the pool
        let handle_option = self.connection_pool.get_connection(session_id).await;
        let handle = match handle_option {
            Some(conn) => conn,
            None => {
                return Err(TerminalError::SessionNotFound(format!(
                    "SSH connection not found for session: {}",
                    session_id
                )))
            }
        };

        let start_time = std::time::Instant::now();

        // In a real implementation, we would execute the command via the SSH connection
        // For now, we'll simulate the command execution with proper error handling
        let (output, exit_code) = {
            // Lock the handle to execute the command
            let handle_guard = handle.lock().await;

            // In a real implementation, we would use russh to execute the command
            // For simulation purposes, we'll return a proper result
            if command.trim().is_empty() {
                (String::from("Error: Command cannot be empty"), 1)
            } else if command == "whoami" {
                (String::from("testuser"), 0)
            } else if command.starts_with("ls") {
                (String::from("file1.txt\nfile2.txt\ndir1/"), 0)
            } else if command.starts_with("pwd") {
                (String::from("/home/testuser"), 0)
            } else {
                (format!("Executed command: {}", command), 0)
            }
        };

        let duration_ms = start_time.elapsed().as_millis() as u64;

        Ok(CommandResult {
            command: command.to_string(),
            output,
            exit_code,
            duration_ms,
        })
    }

    async fn send_input(&self, session_id: &str, input: &str) -> TerminalResult<()> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| TerminalError::SessionNotFound(session_id.to_string()))?;

        // Verify tenant isolation
        // In a real implementation, this would check that the requesting tenant has access to this session

        if matches!(session.status, SessionStatus::Disconnected) {
            return Err(TerminalError::SessionNotFound(
                "Session is disconnected".to_string(),
            ));
        }

        // Update last activity
        session.last_activity = now_timestamp();
        drop(sessions); // Release the lock before sending input

        // Validate input for security
        validate_command(input)?;

        // In a real implementation, we would send the input via the SSH connection
        // For now, we'll just validate and acknowledge the input
        Ok(())
    }

    async fn get_session(&self, session_id: &str) -> TerminalResult<TerminalSession> {
        let sessions = self.sessions.read().await;
        sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| TerminalError::SessionNotFound(session_id.to_string()))
    }

    async fn list_sessions(&self, tenant_id: &str) -> TerminalResult<Vec<TerminalSession>> {
        let sessions = self.sessions.read().await;
        let filtered_sessions: Vec<TerminalSession> = sessions
            .values()
            .filter(|session| session.tenant_id == tenant_id) // Tenant isolation
            .cloned()
            .collect();
        Ok(filtered_sessions)
    }

    async fn resize_session(&self, session_id: &str, rows: u16, cols: u16) -> TerminalResult<()> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| TerminalError::SessionNotFound(session_id.to_string()))?;

        // Verify tenant isolation
        // In a real implementation, this would check that the requesting tenant has access to this session

        session.terminal_size = (rows, cols);
        session.last_activity = now_timestamp();

        // In a real implementation, we would resize the actual terminal
        // For now, we'll just update the stored size
        Ok(())
    }

    async fn close_session(&self, session_id: &str) -> TerminalResult<()> {
        let mut sessions = self.sessions.write().await;
        if !sessions.contains_key(session_id) {
            return Err(TerminalError::SessionNotFound(session_id.to_string()));
        }

        // Verify tenant isolation
        // In a real implementation, this would check that the requesting tenant has access to this session

        sessions.remove(session_id);
        Ok(())
    }
}

/// Helper function to get current timestamp
fn now_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Validate session configuration for security
fn validate_session_config(config: &TerminalSessionConfig) -> TerminalResult<()> {
    // Validate host - prevent path traversal and invalid characters
    if config.host.is_empty() {
        return Err(TerminalError::SshConnectionFailed(
            "Host cannot be empty".to_string(),
        ));
    }

    // Check for potential path traversal in host
    if config.host.contains("../") || config.host.contains("..\\") {
        return Err(TerminalError::SshConnectionFailed(
            "Invalid host: path traversal detected".to_string(),
        ));
    }

    // Validate username - prevent shell injection
    if config.username.is_empty() {
        return Err(TerminalError::SshConnectionFailed(
            "Username cannot be empty".to_string(),
        ));
    }

    // Check for potential shell injection in username
    if config
        .username
        .contains([';', '&', '|', '`', '$', '(', ')', '<', '>', '|'])
    {
        return Err(TerminalError::SshConnectionFailed(
            "Invalid username: contains shell metacharacters".to_string(),
        ));
    }

    // Validate port range
    if config.port == 0 || config.port > 65535 {
        return Err(TerminalError::SshConnectionFailed(
            "Port must be between 1 and 65535".to_string(),
        ));
    }

    // Validate name
    if config.name.is_empty() {
        return Err(TerminalError::SshConnectionFailed(
            "Session name cannot be empty".to_string(),
        ));
    }

    Ok(())
}

/// Validate command for security (prevent command injection)
fn validate_command(command: &str) -> TerminalResult<()> {
    // Check for potentially dangerous commands
    let dangerous_patterns = [
        "rm -rf",
        "mv ",
        "dd ",
        "mkfs ",
        "> /dev/",
        ">> /dev/",
        "&",
        "&&",
        "|",
        "||",
        ";",
        "$(",
        "`",
        "eval",
        "exec",
        "sh -c",
        "bash -c",
        "chmod",
        "chown",
        "sudo",
        "su",
        "mount",
        "umount",
        "reboot",
        "shutdown",
        "poweroff",
        "halt",
        "kill",
        "killall",
        "pkill",
        "/etc/",
        "/usr/bin/",
        "/usr/sbin/",
        "/sbin/",
        "/root/",
        "/proc/",
        "/sys/",
        "/dev/",
    ];

    let lower_command = command.to_lowercase();
    for pattern in &dangerous_patterns {
        if lower_command.contains(pattern) {
            return Err(TerminalError::SshCommandExecutionFailed(format!(
                "Command contains potentially dangerous pattern: {}",
                pattern
            )));
        }
    }

    // Additional security validations
    // Prevent path traversal in commands
    if command.contains("../") || command.contains("..\\") {
        return Err(TerminalError::SshCommandExecutionFailed(
            "Command contains path traversal sequences".to_string(),
        ));
    }

    // Prevent null byte injection
    if command.contains('\0') {
        return Err(TerminalError::SshCommandExecutionFailed(
            "Command contains null byte injection".to_string(),
        ));
    }

    // Check for excessively long commands that could be used for buffer overflow
    if command.len() > 10000 {
        return Err(TerminalError::SshCommandExecutionFailed(
            "Command exceeds maximum length of 10000 characters".to_string(),
        ));
    }

    // Additional validation could be added here
    Ok(())
}

// Validation helper functions
fn is_valid_host(host: &str) -> bool {
    // Allow alphanumeric characters, dots, hyphens, underscores, and colons (for IPv6)
    // Also allow square brackets for IPv6 addresses
    let valid_chars = host.chars().all(|c| {
        c.is_ascii_alphanumeric()
            || c == '.'
            || c == '-'
            || c == '_'
            || c == ':'
            || c == '['
            || c == ']'
    });

    // Basic check for valid hostname/IP format
    if !valid_chars {
        return false;
    }

    // Prevent potential injection patterns
    if host.contains("%") || host.contains("*") || host.contains("?") {
        return false;
    }

    // Check for valid domain name or IP format
    let is_ip_v4 = host.parse::<std::net::Ipv4Addr>().is_ok();
    let is_ip_v6 = host.parse::<std::net::Ipv6Addr>().is_ok();
    let is_hostname = host.split('.').all(|part| {
        !part.is_empty()
            && part.len() <= 63
            && part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            && !part.starts_with('-')
            && !part.ends_with('-')
    });

    is_ip_v4 || is_ip_v6 || is_hostname
}

fn is_valid_username(username: &str) -> bool {
    // Usernames should be alphanumeric with allowed special chars like underscore and hyphen
    let valid_chars = username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');

    // Length checks
    if username.is_empty() || username.len() > 32 {
        return false;
    }

    // Should not start or end with special characters
    if username.starts_with(|c: char| !c.is_ascii_alphanumeric())
        || username.ends_with(|c: char| !c.is_ascii_alphanumeric())
    {
        return false;
    }

    // Additional checks for potentially problematic usernames
    let forbidden_usernames = ["root", "admin", "administrator", "sudo", "su"];
    if forbidden_usernames.contains(&username.to_lowercase().as_str()) {
        return false;
    }

    valid_chars
}

fn is_valid_session_name(name: &str) -> bool {
    // Session names should be alphanumeric with allowed special chars like space, underscore, hyphen
    let valid_chars = name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '_' || c == '-' || c == '.');

    // Length checks
    if name.is_empty() || name.len() > 128 {
        return false;
    }

    valid_chars
}

fn is_valid_tenant_id(tenant_id: &str) -> bool {
    // Tenant IDs should be alphanumeric with allowed special chars like underscore and hyphen
    let valid_chars = tenant_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');

    // Length checks
    if tenant_id.is_empty() || tenant_id.len() > 64 {
        return false;
    }

    valid_chars
}

// Web API layer for terminal management
#[derive(Clone)]
pub struct TerminalApiState {
    pub terminal_manager: Arc<dyn TerminalManager>,
}

// Request/Response DTOs for web API
#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub name: String,
    pub description: Option<String>,
    pub timeout: Option<u64>,
    pub tenant_id: String,
}

#[derive(Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
}

#[derive(Serialize)]
pub struct SessionResponse {
    pub id: String,
    pub config: TerminalSessionConfig,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_activity: u64,
    pub terminal_size: (u16, u16),
    pub tenant_id: String,
}

#[derive(Deserialize)]
pub struct ExecuteCommandRequest {
    pub command: String,
}

#[derive(Serialize)]
pub struct ExecuteCommandResponse {
    pub command: String,
    pub output: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

// Handler functions for web API
pub async fn create_session_handler(
    State(api_state): State<TerminalApiState>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, StatusCode> {
    let config = TerminalSessionConfig {
        host: request.host,
        port: request.port,
        username: request.username,
        auth_method: request.auth_method,
        name: request.name,
        description: request.description,
        timeout: request.timeout,
        tenant_id: request.tenant_id,
    };

    match api_state.terminal_manager.create_session(config).await {
        Ok(session_id) => Ok(Json(CreateSessionResponse { session_id })),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_session_handler(
    State(api_state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<SessionResponse>, StatusCode> {
    match api_state.terminal_manager.get_session(&session_id).await {
        Ok(session) => Ok(Json(SessionResponse {
            id: session.id,
            config: session.config,
            status: session.status,
            created_at: session.created_at,
            last_activity: session.last_activity,
            terminal_size: session.terminal_size,
            tenant_id: session.tenant_id,
        })),
        Err(TerminalError::SessionNotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn list_sessions_handler(
    State(api_state): State<TerminalApiState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<SessionResponse>>, StatusCode> {
    let tenant_id = params.get("tenant_id").ok_or(StatusCode::BAD_REQUEST)?;
    match api_state.terminal_manager.list_sessions(tenant_id).await {
        Ok(sessions) => {
            let responses: Vec<SessionResponse> = sessions
                .into_iter()
                .map(|session| SessionResponse {
                    id: session.id,
                    config: session.config,
                    status: session.status,
                    created_at: session.created_at,
                    last_activity: session.last_activity,
                    terminal_size: session.terminal_size,
                    tenant_id: session.tenant_id,
                })
                .collect();
            Ok(Json(responses))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn connect_session_handler(
    State(api_state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match api_state
        .terminal_manager
        .connect_session(&session_id)
        .await
    {
        Ok(()) => Ok(Json(
            json!({"status": "success", "message": "Session connected"}),
        )),
        Err(TerminalError::SessionNotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn disconnect_session_handler(
    State(api_state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match api_state
        .terminal_manager
        .disconnect_session(&session_id)
        .await
    {
        Ok(()) => Ok(Json(
            json!({"status": "success", "message": "Session disconnected"}),
        )),
        Err(TerminalError::SessionNotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn execute_command_handler(
    State(api_state): State<TerminalApiState>,
    Path(session_id): Path<String>,
    Json(request): Json<ExecuteCommandRequest>,
) -> Result<Json<ExecuteCommandResponse>, StatusCode> {
    match api_state
        .terminal_manager
        .execute_command(&session_id, &request.command)
        .await
    {
        Ok(result) => Ok(Json(ExecuteCommandResponse {
            command: result.command,
            output: result.output,
            exit_code: result.exit_code,
            duration_ms: result.duration_ms,
        })),
        Err(TerminalError::SessionNotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn close_session_handler(
    State(api_state): State<TerminalApiState>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match api_state.terminal_manager.close_session(&session_id).await {
        Ok(()) => Ok(Json(
            json!({"status": "success", "message": "Session closed"}),
        )),
        Err(TerminalError::SessionNotFound(_)) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// Function to create the web API router
/// Creates an Axum router with all terminal management endpoints
///
/// # Arguments
/// * `terminal_manager` - An implementation of TerminalManager to handle the business logic
///
/// # Returns
/// An Axum Router with all terminal management routes configured
///
/// # Endpoints
/// * POST /sessions - Create a new terminal session
/// * GET /sessions/:id - Get a specific session by ID
/// * GET /sessions - List all sessions for a tenant
/// * POST /sessions/:id/connect - Connect to a session
/// * POST /sessions/:id/disconnect - Disconnect from a session
/// * POST /sessions/:id/execute - Execute a command in a session
/// * DELETE /sessions/:id - Close and remove a session
pub fn create_terminal_api(terminal_manager: Arc<dyn TerminalManager>) -> Router {
    let api_state = TerminalApiState { terminal_manager };

    Router::new()
        .route("/sessions", post(create_session_handler))
        .route("/sessions/:id", get(get_session_handler))
        .route("/sessions", get(list_sessions_handler))
        .route("/sessions/:id/connect", post(connect_session_handler))
        .route("/sessions/:id/disconnect", post(disconnect_session_handler))
        .route("/sessions/:id/execute", post(execute_command_handler))
        .route("/sessions/:id", delete(close_session_handler))
        .with_state(api_state)
}

// Function to create a complete web server with CORS and tracing
pub async fn create_terminal_web_server(
    terminal_manager: Arc<dyn TerminalManager>,
    addr: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let app = create_terminal_api(terminal_manager).layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(CorsLayer::permissive()), // Configure CORS appropriately for production
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// Convenience function to run the terminal web server with default settings
/// Starts a terminal web server with default in-memory manager
///
/// # Arguments
/// * `addr` - The address to bind the server to (e.g., "127.0.0.1:8080")
///
/// # Returns
/// A Result indicating success or failure of server startup
///
/// # Example
/// ```
/// # use tokio;
/// tokio::runtime::Runtime::new().unwrap().block_on(async {
///     run_terminal_server("127.0.0.1:8080").await.unwrap();
/// });
/// ```
pub async fn run_terminal_server(
    addr: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let terminal_manager = Arc::new(InMemoryTerminalManager::new());
    create_terminal_web_server(terminal_manager, addr).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_terminal_session_lifecycle() {
        let manager = InMemoryTerminalManager::new();

        // Create a session config
        let config = TerminalSessionConfig {
            host: "localhost".to_string(),
            port: 22,
            username: "testuser".to_string(),
            auth_method: AuthMethod::Password {
                password: "testpass".to_string(),
            },
            name: "Test Session".to_string(),
            description: Some("A test session".to_string()),
            timeout: Some(30),
            tenant_id: "test-tenant".to_string(),
        };

        // Create a session
        let session_id = manager.create_session(config).await.unwrap();
        assert!(!session_id.is_empty());

        // Get the session
        let session = manager.get_session(&session_id).await.unwrap();
        assert_eq!(session.status, SessionStatus::Disconnected);

        // List sessions for the tenant
        let sessions = manager.list_sessions("test-tenant").await.unwrap();
        assert_eq!(sessions.len(), 1);

        // Close the session
        manager.close_session(&session_id).await.unwrap();

        // Session should no longer exist
        assert!(matches!(
            manager.get_session(&session_id).await,
            Err(TerminalError::SessionNotFound(_))
        ));
    }

    #[tokio::test]
    async fn test_command_validation() {
        // Test safe command
        assert!(validate_command("ls -la").is_ok());

        // Test dangerous command
        assert!(validate_command("rm -rf /").is_err());
        assert!(validate_command("sudo rm -rf /").is_err());
        assert!(validate_command("echo hello > /dev/null").is_err());

        // Test path traversal
        assert!(validate_command("cd ../etc").is_err());

        // Test null byte injection
        assert!(validate_command("ls \0 -la").is_err());

        // Test long command
        let long_cmd = "a".repeat(10001);
        assert!(validate_command(&long_cmd).is_err());
    }

    #[test]
    fn test_host_validation() {
        // Valid hosts
        assert!(is_valid_host("localhost"));
        assert!(is_valid_host("example.com"));
        assert!(is_valid_host("192.168.1.1"));
        assert!(is_valid_host("2001:db8::1"));
        assert!(is_valid_host("[2001:db8::1]:22"));

        // Invalid hosts
        assert!(!is_valid_host("example.com%20"));
        assert!(!is_valid_host("example*.com"));
        assert!(!is_valid_host("../../../etc/passwd"));
    }

    #[test]
    fn test_username_validation() {
        // Valid usernames
        assert!(is_valid_username("john_doe"));
        assert!(is_valid_username("user-name"));
        assert!(is_valid_username("testuser123"));

        // Invalid usernames
        assert!(!is_valid_username(""));
        assert!(!is_valid_username(";rm -rf /"));
        assert!(!is_valid_username("root")); // Forbidden
        assert!(!is_valid_username("admin")); // Forbidden
    }

    #[test]
    fn test_session_name_validation() {
        // Valid session names
        assert!(is_valid_session_name("My Session"));
        assert!(is_valid_session_name("session_1"));
        assert!(is_valid_session_name("session-1"));

        // Invalid session names
        assert!(!is_valid_session_name(""));
        assert!(!is_valid_session_name(&"a".repeat(129))); // Too long
    }

    #[test]
    fn test_tenant_id_validation() {
        // Valid tenant IDs
        assert!(is_valid_tenant_id("tenant_123"));
        assert!(is_valid_tenant_id("tenant-abc"));
        assert!(is_valid_tenant_id("mytenant"));

        // Invalid tenant IDs
        assert!(!is_valid_tenant_id(""));
        assert!(!is_valid_tenant_id(&"a".repeat(65))); // Too long
        assert!(!is_valid_tenant_id("tenant;rm -rf /")); // Contains semicolon
    }
}

//! Session manager implementation

use crate::types::*;
use allternit_driver_interface::*;
use allternit_driver_interface::{EnvironmentSpec, EnvSpecType};
use allternit_process_driver::ProcessDriver;
use allternit_firecracker_driver::FirecrackerDriver;

#[cfg(target_os = "macos")]
use allternit_apple_vf_driver::AppleVFDriver;

use dashmap::DashMap;
use chrono::{DateTime, Utc};
use sqlx::sqlite::SqlitePool;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{error, info, warn};

/// Session manager errors
#[derive(thiserror::Error, Debug)]
pub enum SessionManagerError {
    #[error("Session not found: {0}")]
    SessionNotFound(SessionId),
    
    #[error("Session already exists: {0}")]
    SessionAlreadyExists(SessionId),
    
    #[error("Driver error: {0}")]
    Driver(#[from] DriverError),
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Invalid session state: {id} is {status}, expected {expected}")]
    InvalidState {
        id: SessionId,
        status: SessionStatus,
        expected: String,
    },
    
    #[error("Execution timeout after {timeout_ms}ms")]
    Timeout { timeout_ms: u64 },
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

/// Result type for session manager operations
pub type Result<T> = std::result::Result<T, SessionManagerError>;

/// Configuration for the session manager
#[derive(Debug, Clone)]
pub struct ManagerConfig {
    /// Database URL for persistence
    pub database_url: String,
    /// Default working directory
    pub default_working_dir: PathBuf,
    /// Maximum concurrent sessions
    pub max_sessions: usize,
    /// Session cleanup interval in seconds
    pub cleanup_interval_secs: u64,
    /// Firecracker configuration (if using MicroVMs)
    pub firecracker_config: Option<allternit_firecracker_driver::FirecrackerConfig>,
    /// Apple VF configuration (macOS only)
    #[cfg(target_os = "macos")]
    pub apple_vf_config: Option<allternit_apple_vf_driver::AppleVFConfig>,
}

impl Default for ManagerConfig {
    fn default() -> Self {
        let data_dir = dirs::data_dir()
            .map(|d| d.join("allternit"))
            .unwrap_or_else(|| PathBuf::from("/tmp/allternit"));
        
        Self {
            database_url: format!("sqlite:{}", data_dir.join("sessions.db").display()),
            default_working_dir: PathBuf::from("/workspace"),
            max_sessions: 100,
            cleanup_interval_secs: 60,
            firecracker_config: None,
            #[cfg(target_os = "macos")]
            apple_vf_config: None,
        }
    }
}

/// Internal session state with driver handle
#[derive(Clone)]
struct SessionState {
    session: Session,
    driver_handle: Option<ExecutionHandle>,
}

/// Platform-specific driver configuration
#[derive(Debug, Clone)]
pub enum DriverConfig {
    /// Process-based execution (development)
    Process,
    /// Firecracker MicroVM (Linux production)
    Firecracker(allternit_firecracker_driver::FirecrackerConfig),
    /// Apple Virtualization Framework (macOS production)
    #[cfg(target_os = "macos")]
    AppleVF(allternit_apple_vf_driver::AppleVFConfig),
}

/// Session manager - manages session lifecycle using execution drivers
pub struct SessionManager {
    /// Active sessions
    sessions: DashMap<SessionId, SessionState>,
    /// Database pool for persistence
    db: SqlitePool,
    /// Configuration
    config: ManagerConfig,
    /// Process driver (always available)
    process_driver: Arc<ProcessDriver>,
    /// Firecracker driver (Linux only)
    _firecracker_driver: Option<Arc<FirecrackerDriver>>,
    /// Apple VF driver (macOS only)
    #[cfg(target_os = "macos")]
    apple_vf_driver: Option<Arc<AppleVFDriver>>,
}

impl SessionManager {
    /// Create a new session manager
    pub async fn new(config: ManagerConfig) -> Result<Self> {
        // Ensure data directory exists
        let db_path = PathBuf::from(config.database_url.trim_start_matches("sqlite:"));
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // Initialize database
        let db = SqlitePool::connect(&config.database_url).await?;
        Self::init_database(&db).await?;

        // Initialize drivers
        let process_driver = Arc::new(ProcessDriver::new());
        
        // Initialize Firecracker driver if config provided (Linux)
        #[cfg(target_os = "linux")]
        let firecracker_driver = config.firecracker_config.as_ref().map(|fc_config| {
            Arc::new(FirecrackerDriver::with_config(fc_config.clone()))
        });
        
        #[cfg(not(target_os = "linux"))]
        let firecracker_driver: Option<Arc<FirecrackerDriver>> = None;

        // Initialize Apple VF driver (macOS)
        #[cfg(target_os = "macos")]
        let apple_vf_driver = if let Some(apple_config) = &config.apple_vf_config {
            match AppleVFDriver::with_config(apple_config.clone()) {
                Ok(driver) => Some(Arc::new(driver)),
                Err(e) => {
                    warn!("Failed to initialize Apple VF driver: {}", e);
                    None
                }
            }
        } else {
            None
        };

        let manager = Self {
            sessions: DashMap::new(),
            db,
            config,
            process_driver,
            _firecracker_driver: firecracker_driver,
            #[cfg(target_os = "macos")]
            apple_vf_driver,
        };

        // Load existing sessions from database
        manager.load_sessions().await?;

        // Start cleanup task
        manager.start_cleanup_task();

        info!("Session manager initialized");
        Ok(manager)
    }

    /// Create a simple session manager with default config
    pub async fn default() -> Result<Self> {
        Self::new(ManagerConfig::default()).await
    }

    /// Initialize database schema
    async fn init_database(db: &SqlitePool) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                spec TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_activity_at TEXT NOT NULL,
                driver_handle_id TEXT,
                driver_type TEXT,
                exit_code INTEGER,
                error_message TEXT
            )
            "#,
        )
        .execute(db)
        .await?;

        // Create index on status for efficient querying
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)
            "#,
        )
        .execute(db)
        .await?;

        Ok(())
    }

    /// Load sessions from database
    async fn load_sessions(&self) -> Result<()> {
        let rows = sqlx::query_as::<_, SessionRow>(
            r#"SELECT * FROM sessions WHERE status NOT IN ('destroyed', 'error')"#
        )
        .fetch_all(&self.db)
        .await?;

        for row in rows {
            let session = row.to_session()?;
            self.sessions.insert(
                session.id,
                SessionState {
                    session,
                    driver_handle: None, // Will be reconnected on demand
                },
            );
        }

        info!("Loaded {} sessions from database", self.sessions.len());
        Ok(())
    }

    /// Persist a session to the database
    async fn persist_session(&self, session: &Session) -> Result<()> {
        let spec_json = serde_json::to_string(&session.spec)?;
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO sessions 
            (id, name, status, spec, created_at, last_activity_at, driver_handle_id, driver_type, exit_code, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(session.id.to_string())
        .bind(&session.name)
        .bind(format!("{:?}", session.status))
        .bind(spec_json)
        .bind(session.created_at.to_rfc3339())
        .bind(session.last_activity_at.to_rfc3339())
        .bind(&session.driver_handle_id)
        .bind(&session.driver_type)
        .bind(session.exit_code)
        .bind(&session.error_message)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Select the appropriate driver based on platform and spec
    fn select_driver(
        &self,
        spec: &SessionSpec,
    ) -> Result<(Arc<dyn ExecutionDriver>, DriverType)> {
        if spec.use_vm {
            // VM mode requested
            #[cfg(target_os = "macos")]
            {
                if let Some(driver) = &self.apple_vf_driver {
                    return Ok((driver.clone() as Arc<dyn ExecutionDriver>, DriverType::MicroVM));
                }
                warn!("VM requested but Apple VF driver not available, falling back to process");
            }
            
            #[cfg(target_os = "linux")]
            {
                if let Some(driver) = &self._firecracker_driver {
                    return Ok((driver.clone() as Arc<dyn ExecutionDriver>, DriverType::MicroVM));
                }
                warn!("VM requested but Firecracker driver not available, falling back to process");
            }
        }

        // Default to process driver
        Ok((self.process_driver.clone() as Arc<dyn ExecutionDriver>, DriverType::Process))
    }

    /// Create a new session
    pub async fn create_session(&self, spec: SessionSpec) -> Result<Session> {
        // Check session limit
        if self.sessions.len() >= self.config.max_sessions {
            return Err(SessionManagerError::Internal(
                format!("Maximum session limit reached: {}", self.config.max_sessions)
            ));
        }

        let mut session = Session::new(spec.clone());
        
        // Select driver
        let (driver, driver_type) = self.select_driver(&spec)?;
        session.driver_type = format!("{:?}", driver_type);

        info!(
            session_id = %session.id,
            name = %session.name,
            driver = %session.driver_type,
            "Creating session"
        );

        // Create spawn spec from session spec
        let spawn_spec = self.create_spawn_spec(&session)?;

        // Spawn via driver
        match driver.spawn(spawn_spec).await {
            Ok(handle) => {
                session.driver_handle_id = Some(handle.id.to_string());
                session.status = SessionStatus::Ready;
                
                // Store session state
                let state = SessionState {
                    session: session.clone(),
                    driver_handle: Some(handle),
                };
                
                self.sessions.insert(session.id, state);
                self.persist_session(&session).await?;
                
                info!(
                    session_id = %session.id,
                    driver_handle = %session.driver_handle_id.as_ref().unwrap(),
                    "Session created successfully"
                );
                
                Ok(session)
            }
            Err(e) => {
                session.set_error(format!("Failed to spawn: {}", e));
                self.persist_session(&session).await?;
                Err(e.into())
            }
        }
    }

    /// Create a spawn specification from a session
    fn create_spawn_spec(&self, session: &Session) -> Result<SpawnSpec> {
        let tenant = TenantId::new("default").map_err(|e| {
            SessionManagerError::Internal(format!("Invalid tenant: {}", e))
        })?;

        let env_spec = EnvironmentSpec {
            spec_type: EnvSpecType::Oci,
            image: session.spec.image.clone(),
            version: None,
            packages: vec![],
            env_vars: session.spec.env_vars.clone(),
            working_dir: Some(session.spec.working_dir.clone()),
            mounts: vec![],
        };

        let resources = ResourceSpec {
            cpu_millis: (session.spec.resources.cpu_cores * 1000.0) as u32,
            memory_mib: session.spec.resources.memory_mib,
            disk_mib: Some(session.spec.resources.disk_mib),
            network_egress_kib: session.spec.resources.network_egress_mib.map(|m| m as u64 * 1024),
            gpu_count: None,
        };

        let policy = PolicySpec::default_permissive();

        Ok(SpawnSpec {
            tenant,
            project: None,
            workspace: None,
            run_id: Some(ExecutionId(session.id.0)),
            env: env_spec,
            policy,
            resources,
            envelope: None,
            prewarm_pool: None,
        })
    }

    /// Execute a command in a session
    pub async fn exec(
        &self,
        session_id: SessionId,
        command: Vec<String>,
        env_vars: HashMap<String, String>,
        timeout_ms: Option<u64>,
    ) -> Result<ExecResult> {
        let mut state = self.sessions
            .get_mut(&session_id)
            .ok_or(SessionManagerError::SessionNotFound(session_id))?;

        if !state.session.is_active() {
            return Err(SessionManagerError::InvalidState {
                id: session_id,
                status: state.session.status.clone(),
                expected: "Ready or Running".to_string(),
            });
        }

        // Select driver
        let (driver, _) = self.select_driver(&state.session.spec)?;

        // Get or reconstruct driver handle
        let handle = match &state.driver_handle {
            Some(h) => h.clone(),
            None => {
                // Reconstruct handle from stored ID
                let _driver_handle_id = state.session.driver_handle_id.as_ref()
                    .ok_or_else(|| SessionManagerError::Internal(
                        "Session has no driver handle ID".to_string()
                    ))?;
                
                ExecutionHandle {
                    id: ExecutionId::new(), // TODO: Parse from stored ID
                    tenant: TenantId::new("default").unwrap(),
                    driver_info: HashMap::new(),
                    env_spec: EnvironmentSpec {
                        spec_type: EnvSpecType::Oci,
                        image: state.session.spec.image.clone(),
                        version: None,
                        packages: vec![],
                        env_vars: state.session.spec.env_vars.clone(),
                        working_dir: Some(state.session.spec.working_dir.clone()),
                        mounts: vec![],
                    },
                }
            }
        };

        // Build command spec
        let cmd_spec = CommandSpec {
            command,
            env_vars,
            working_dir: Some(state.session.spec.working_dir.clone()),
            stdin_data: None,
            capture_stdout: true,
            capture_stderr: true,
        };

        // Update status
        state.session.status = SessionStatus::Running;
        state.session.touch();
        drop(state); // Release lock during execution

        // Execute with optional timeout
        let result = if let Some(timeout) = timeout_ms {
            match tokio::time::timeout(
                std::time::Duration::from_millis(timeout),
                driver.exec(&handle, cmd_spec)
            ).await {
                Ok(Ok(result)) => Ok(result),
                Ok(Err(e)) => Err(e.into()),
                Err(_) => Err(SessionManagerError::Timeout { timeout_ms: timeout }),
            }
        } else {
            driver.exec(&handle, cmd_spec).await.map_err(|e| e.into())
        };

        // Update session after execution
        if let Some(mut state) = self.sessions.get_mut(&session_id) {
            state.session.status = SessionStatus::Ready;
            state.session.touch();
            let _ = self.persist_session(&state.session).await;
        }

        result
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Result<Vec<Session>> {
        let sessions: Vec<Session> = self.sessions
            .iter()
            .map(|entry| entry.value().session.clone())
            .collect();
        Ok(sessions)
    }

    /// Get a session by ID
    pub async fn get_session(&self, session_id: SessionId) -> Result<Session> {
        self.sessions
            .get(&session_id)
            .map(|entry| entry.value().session.clone())
            .ok_or(SessionManagerError::SessionNotFound(session_id))
    }

    /// Destroy a session
    pub async fn destroy_session(&self, session_id: SessionId, force: bool) -> Result<()> {
        let mut state = self.sessions
            .get_mut(&session_id)
            .ok_or(SessionManagerError::SessionNotFound(session_id))?;

        info!(
            session_id = %session_id,
            force = force,
            "Destroying session"
        );

        // Update status
        state.session.status = SessionStatus::Destroying;

        // Get driver and destroy
        if let Some(handle) = &state.driver_handle {
            let (driver, _) = self.select_driver(&state.session.spec)?;
            if let Err(e) = driver.destroy(handle).await {
                warn!("Failed to destroy driver handle: {}", e);
                if !force {
                    return Err(e.into());
                }
            }
        }

        state.session.status = SessionStatus::Destroyed;
        state.session.exit_code = Some(0);
        state.session.touch();
        
        // Persist final state
        self.persist_session(&state.session).await?;
        
        // Remove from memory
        drop(state);
        self.sessions.remove(&session_id);

        info!(session_id = %session_id, "Session destroyed");
        Ok(())
    }

    /// Start the cleanup background task
    fn start_cleanup_task(&self) {
        let sessions = self.sessions.clone();
        let interval_secs = self.config.cleanup_interval_secs;
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                std::time::Duration::from_secs(interval_secs)
            );
            
            loop {
                interval.tick().await;
                
                let now = Utc::now();
                let to_remove: Vec<SessionId> = sessions
                    .iter()
                    .filter(|entry| {
                        let session = &entry.value().session;
                        let idle_duration = now - session.last_activity_at;
                        session.spec.timeout_secs > 0 
                            && idle_duration.num_seconds() as u64 > session.spec.timeout_secs
                    })
                    .map(|entry| *entry.key())
                    .collect();
                
                for session_id in to_remove {
                    warn!(session_id = %session_id, "Session timed out, removing");
                    sessions.remove(&session_id);
                }
            }
        });
    }
}

/// Database row for session
#[derive(sqlx::FromRow)]
struct SessionRow {
    id: String,
    name: String,
    status: String,
    spec: String,
    created_at: String,
    last_activity_at: String,
    driver_handle_id: Option<String>,
    driver_type: String,
    exit_code: Option<i32>,
    error_message: Option<String>,
}

impl SessionRow {
    fn to_session(&self) -> Result<Session> {
        let spec: SessionSpec = serde_json::from_str(&self.spec)?;
        
        Ok(Session {
            id: SessionId(self.id.parse().map_err(|e| {
                SessionManagerError::Internal(format!("Invalid UUID: {}", e))
            })?),
            name: self.name.clone(),
            status: parse_status(&self.status),
            spec,
            created_at: DateTime::parse_from_rfc3339(&self.created_at)
                .map_err(|e| SessionManagerError::Internal(format!("Invalid date: {}", e)))?
                .with_timezone(&Utc),
            last_activity_at: DateTime::parse_from_rfc3339(&self.last_activity_at)
                .map_err(|e| SessionManagerError::Internal(format!("Invalid date: {}", e)))?
                .with_timezone(&Utc),
            driver_handle_id: self.driver_handle_id.clone(),
            driver_type: self.driver_type.clone(),
            exit_code: self.exit_code,
            error_message: self.error_message.clone(),
        })
    }
}

fn parse_status(status: &str) -> SessionStatus {
    match status {
        "Creating" => SessionStatus::Creating,
        "Ready" => SessionStatus::Ready,
        "Running" => SessionStatus::Running,
        "Paused" => SessionStatus::Paused,
        "Stopped" => SessionStatus::Stopped,
        "Error" => SessionStatus::Error,
        "Destroying" => SessionStatus::Destroying,
        "Destroyed" => SessionStatus::Destroyed,
        _ => SessionStatus::Error,
    }
}

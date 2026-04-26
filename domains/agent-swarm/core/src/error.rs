use thiserror::Error;

/// Main error type for the meta-swarm system
#[derive(Error, Debug)]
pub enum SwarmError {
    /// Configuration errors
    #[error("Configuration error: {0}")]
    Config(String),

    /// Task-related errors
    #[error("Task error: {0}")]
    Task(#[from] TaskError),

    /// Agent-related errors
    #[error("Agent error: {0}")]
    Agent(#[from] AgentError),

    /// Execution errors
    #[error("Execution error: {0}")]
    Execution(#[from] ExecutionError),

    /// Knowledge base errors
    #[error("Knowledge error: {0}")]
    Knowledge(#[from] KnowledgeError),

    /// Policy/governance errors
    #[error("Policy error: {0}")]
    Policy(#[from] PolicyError),

    /// Routing errors
    #[error("Routing error: {0}")]
    Routing(String),

    /// PSO optimization errors
    #[error("PSO error: {0}")]
    Pso(String),

    /// Integration errors with Allternit systems
    #[error("Integration error: {source}")]
    Integration {
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Serialization errors
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// Budget exceeded
    #[error("Budget exceeded: spent ${spent:.2} of ${budget:.2}")]
    BudgetExceeded { spent: f64, budget: f64 },

    /// Timeout
    #[error("Timeout after {seconds} seconds")]
    Timeout { seconds: u64 },

    /// Cancelled
    #[error("Operation cancelled")]
    Cancelled,

    /// Unknown error
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl SwarmError {
    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            SwarmError::Execution(ExecutionError::AgentFailed { retryable: true, .. })
                | SwarmError::Execution(ExecutionError::Timeout)
                | SwarmError::Integration { .. }
                | SwarmError::Io(_)
        )
    }

    /// Get suggested retry count
    pub fn suggested_retries(&self) -> u32 {
        match self {
            SwarmError::Execution(ExecutionError::AgentFailed { .. }) => 3,
            SwarmError::Execution(ExecutionError::Timeout) => 2,
            SwarmError::Integration { .. } => 3,
            SwarmError::Io(_) => 2,
            _ => 0,
        }
    }
}

/// Task-related errors
#[derive(Error, Debug)]
pub enum TaskError {
    #[error("Task not found: {id}")]
    NotFound { id: String },

    #[error("Invalid task classification: {0}")]
    InvalidClassification(String),

    #[error("Task constraints violated: {constraint}")]
    ConstraintViolation { constraint: String },

    #[error("Circular dependency detected in subtasks")]
    CircularDependency,

    #[error("Task already exists: {id}")]
    Duplicate { id: String },

    #[error("Task is in invalid state for operation: {state}")]
    InvalidState { state: String },
}

/// Agent-related errors
#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Agent not found: {id}")]
    NotFound { id: String },

    #[error("Agent {id} is not available (current state: {state})")]
    NotAvailable { id: String, state: String },

    #[error("Agent {id} lacks required capability: {capability}")]
    MissingCapability { id: String, capability: String },

    #[error("Agent pool exhausted")]
    PoolExhausted,

    #[error("Invalid agent configuration: {0}")]
    InvalidConfig(String),

    #[error("Agent {id} exceeded maximum iterations")]
    MaxIterationsExceeded { id: String },
}

/// Execution-related errors
#[derive(Error, Debug)]
pub enum ExecutionError {
    #[error("Agent {agent_id} failed: {message} (retryable: {retryable})")]
    AgentFailed {
        agent_id: String,
        message: String,
        retryable: bool,
    },

    #[error("Dependency not satisfied: {dependency_id}")]
    DependencyNotSatisfied { dependency_id: String },

    #[error("File conflict: {file} is locked by {agent}")]
    FileConflict { file: String, agent: String },

    #[error("Quality gate failed: {reason}")]
    QualityGateFailed { reason: String },

    #[error("Execution timeout")]
    Timeout,

    #[error("Execution cancelled")]
    Cancelled,

    #[error("Wave execution failed: {failed} of {total} agents failed")]
    WaveFailed { failed: usize, total: usize },

    #[error("Deadlock detected in agent dependencies")]
    Deadlock,
}

/// Knowledge base errors
#[derive(Error, Debug)]
pub enum KnowledgeError {
    #[error("Pattern not found: {id}")]
    PatternNotFound { id: String },

    #[error("Solution not found: {id}")]
    SolutionNotFound { id: String },

    #[error("Query failed: {0}")]
    QueryFailed(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Invalid pattern: {0}")]
    InvalidPattern(String),

    #[error("Knowledge base is unavailable")]
    Unavailable,
}

/// Policy/governance errors
#[derive(Error, Debug)]
pub enum PolicyError {
    #[error("Policy violation: {policy}")]
    Violation { policy: String },

    #[error("Approval required: {request_type}")]
    ApprovalRequired { request_type: String },

    #[error("Approval denied for: {request_type}")]
    ApprovalDenied { request_type: String },

    #[error("WIH integration error: {0}")]
    WIH(String),

    #[error("Governance check failed: {0}")]
    GovernanceCheck(String),
}

/// Result type alias
pub type SwarmResult<T> = Result<T, SwarmError>;

/// Context for errors
pub trait ErrorContext<T> {
    fn context(self, msg: impl Into<String>) -> SwarmResult<T>;
    fn with_context<F>(self, f: F) -> SwarmResult<T>
    where
        F: FnOnce() -> String;
}

impl<T> ErrorContext<T> for SwarmResult<T> {
    fn context(self, msg: impl Into<String>) -> SwarmResult<T> {
        self.map_err(|e| SwarmError::Unknown(format!("{}: {}", msg.into(), e)))
    }

    fn with_context<F>(self, f: F) -> SwarmResult<T>
    where
        F: FnOnce() -> String,
    {
        self.map_err(|e| SwarmError::Unknown(format!("{}: {}", f(), e)))
    }
}

/// Retry policy configuration
#[derive(Debug, Clone, Copy)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 1000,
            max_delay_ms: 60000,
            backoff_multiplier: 2.0,
        }
    }
}

impl RetryPolicy {
    pub fn new(max_attempts: u32) -> Self {
        Self {
            max_attempts,
            ..Default::default()
        }
    }

    pub fn with_backoff(mut self, base_ms: u64, max_ms: u64, multiplier: f64) -> Self {
        self.base_delay_ms = base_ms;
        self.max_delay_ms = max_ms;
        self.backoff_multiplier = multiplier;
        self
    }

    /// Calculate delay for a specific attempt (0-indexed)
    pub fn delay_for_attempt(&self, attempt: u32) -> u64 {
        if attempt == 0 {
            return 0;
        }
        let delay = self.base_delay_ms as f64 * self.backoff_multiplier.powi(attempt as i32 - 1);
        (delay as u64).min(self.max_delay_ms)
    }
}

/// Circuit breaker for fault tolerance
#[derive(Debug)]
pub struct CircuitBreaker {
    failure_threshold: u32,
    success_threshold: u32,
    timeout_secs: u64,
    state: CircuitState,
    failures: u32,
    successes: u32,
    last_failure_time: Option<std::time::Instant>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,     // Normal operation
    Open,       // Failing, reject requests
    HalfOpen,   // Testing if recovered
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, success_threshold: u32, timeout_secs: u64) -> Self {
        Self {
            failure_threshold,
            success_threshold,
            timeout_secs,
            state: CircuitState::Closed,
            failures: 0,
            successes: 0,
            last_failure_time: None,
        }
    }

    pub fn can_execute(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if timeout has passed
                if let Some(last_failure) = self.last_failure_time {
                    if last_failure.elapsed().as_secs() >= self.timeout_secs {
                        self.state = CircuitState::HalfOpen;
                        self.successes = 0;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    pub fn record_success(&mut self) {
        match self.state {
            CircuitState::Closed => {
                self.failures = 0;
            }
            CircuitState::HalfOpen => {
                self.successes += 1;
                if self.successes >= self.success_threshold {
                    self.state = CircuitState::Closed;
                    self.failures = 0;
                    self.successes = 0;
                }
            }
            CircuitState::Open => {}
        }
    }

    pub fn record_failure(&mut self) {
        self.failures += 1;
        self.last_failure_time = Some(std::time::Instant::now());

        if self.state == CircuitState::HalfOpen || self.failures >= self.failure_threshold {
            self.state = CircuitState::Open;
        }
    }

    pub fn state(&self) -> CircuitState {
        self.state
    }
}

//! Terminal Session Security Module
//! 
//! This module provides enhanced security utilities for terminal session management
//! including input sanitization, command validation, rate limiting, and resource limits.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

// ============================================================================
// Configuration Constants
// ============================================================================

/// Maximum input length in characters
pub const MAX_INPUT_LENGTH: usize = 4096;

/// Maximum output buffer size (1MB)
pub const MAX_OUTPUT_BUFFER_SIZE: usize = 1024 * 1024;

/// Maximum number of output lines
pub const MAX_OUTPUT_LINES: usize = 10000;

/// Rate limit window in seconds
pub const RATE_LIMIT_WINDOW_SECS: u64 = 60;

/// Maximum commands per rate limit window
pub const MAX_COMMANDS_PER_WINDOW: u32 = 60;

/// Command timeout in seconds
pub const COMMAND_TIMEOUT_SECS: u64 = 300; // 5 minutes

/// Session timeout in seconds (1 hour)
pub const SESSION_TIMEOUT_SECS: u64 = 3600;

/// Maximum reconnection attempts
pub const MAX_RECONNECT_ATTEMPTS: u32 = 5;

// ============================================================================
// Security Error Types
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub enum SecurityErrorCode {
    InputTooLong,
    InvalidCharacters,
    DangerousCommand,
    RateLimitExceeded,
    Unauthorized,
    BufferOverflow,
    Timeout,
    InvalidEscapeSequence,
    PathTraversal,
    CommandInjection,
}

impl std::fmt::Display for SecurityErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SecurityErrorCode::InputTooLong => write!(f, "INPUT_TOO_LONG"),
            SecurityErrorCode::InvalidCharacters => write!(f, "INVALID_CHARACTERS"),
            SecurityErrorCode::DangerousCommand => write!(f, "DANGEROUS_COMMAND"),
            SecurityErrorCode::RateLimitExceeded => write!(f, "RATE_LIMIT_EXCEEDED"),
            SecurityErrorCode::Unauthorized => write!(f, "UNAUTHORIZED"),
            SecurityErrorCode::BufferOverflow => write!(f, "BUFFER_OVERFLOW"),
            SecurityErrorCode::Timeout => write!(f, "TIMEOUT"),
            SecurityErrorCode::InvalidEscapeSequence => write!(f, "INVALID_ESCAPE_SEQUENCE"),
            SecurityErrorCode::PathTraversal => write!(f, "PATH_TRAVERSAL"),
            SecurityErrorCode::CommandInjection => write!(f, "COMMAND_INJECTION"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct TerminalSecurityError {
    pub code: SecurityErrorCode,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

impl std::fmt::Display for TerminalSecurityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for TerminalSecurityError {}

// ============================================================================
// Input Sanitization
// ============================================================================

/// Characters that are allowed in terminal input (printable ASCII + tabs/newlines)
const ALLOWED_INPUT_CHARS: &str = 
    " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\t\n\r";

/// Sanitizes terminal input to prevent injection attacks
pub fn sanitize_terminal_input(input: &str) -> Result<String, TerminalSecurityError> {
    // Check length limit
    if input.len() > MAX_INPUT_LENGTH {
        return Err(TerminalSecurityError {
            code: SecurityErrorCode::InputTooLong,
            message: format!("Input exceeds maximum length of {} characters", MAX_INPUT_LENGTH),
            details: Some(serde_json::json!({ "length": input.len(), "max": MAX_INPUT_LENGTH })),
        });
    }

    // Remove null bytes and dangerous sequences
    let mut sanitized = input
        .replace('\0', "")           // Null bytes
        .replace("\x1b[K", "")       // Clear line sequences
        .replace("\x1b[J", "")       // Clear screen sequences
        .replace("\x1b[2J", "")      // Clear entire screen
        .replace("\x1b[3J", "");     // Clear scrollback

    // Remove OSC 8 hyperlinks (can be used for phishing)
    // OSC 8 format: ESC ] 8 ; params ; URI ST
    let osc8_pattern = regex::Regex::new(r"\x1b\]8;[^;]*;[^\x1b]*(?:|\x1b\\)").unwrap();
    sanitized = osc8_pattern.replace_all(&sanitized, "").to_string();

    // Remove OSC 52 (clipboard manipulation)
    let osc52_pattern = regex::Regex::new(r"\x1b\]52;[^;]*;[^\x1b]*(?:|\x1b\\)").unwrap();
    sanitized = osc52_pattern.replace_all(&sanitized, "").to_string();

    // Filter to only allowed characters
    sanitized = sanitized
        .chars()
        .filter(|c| ALLOWED_INPUT_CHARS.contains(*c))
        .collect();

    Ok(sanitized)
}

/// Validates escape sequences to ensure they're safe
pub fn validate_escape_sequences(input: &str) -> Result<(), TerminalSecurityError> {
    // Allowed escape sequences (safe subset)
    let allowed_prefixes = [
        "\x1b[",   // CSI sequences
        "\x1b]",   // OSC sequences (will be further validated)
        "\x1b(",   // Charset sequences
        "\x1b)",   // Charset sequences
        "\x1b#",   // Line attributes
        "\x1b%",   // Character set selection
        "\x1b6",   // Back index
        "\x1b7",   // Save cursor
        "\x1b8",   // Restore cursor
        "\x1b=",   // Application keypad
        "\x1b>",   // Normal keypad
        "\x1bM",   // Reverse index
    ];

    // Check for dangerous OSC sequences
    let dangerous_osc = regex::Regex::new(r"\x1b\]([3-9]\d?|[1-9]\d{2,});").unwrap();
    if dangerous_osc.is_match(input) {
        return Err(TerminalSecurityError {
            code: SecurityErrorCode::InvalidEscapeSequence,
            message: "Dangerous OSC sequence detected".to_string(),
            details: None,
        });
    }

    Ok(())
}

// ============================================================================
// Command Injection Prevention
// ============================================================================

/// Commands that are blocked entirely
const BLOCKED_COMMANDS: &[&str] = &[
    "rm", "mv", "cp", "dd", "mkfs", "fdisk", "format",
    "sudo", "su", "doas", "pkexec",
    "chmod", "chown", "chgrp", "chattr",
    "mount", "umount", "mountpoint",
    "reboot", "shutdown", "poweroff", "halt", "init",
    "kill", "killall", "pkill", "xkill",
    "eval", "exec", "source",
    "wget", "curl", "fetch", "nc", "netcat",
    "ssh", "telnet", "ftp", "sftp",
    "python", "python3", "perl", "ruby", "node", "nodejs",
    "bash", "sh", "zsh", "fish", "csh", "tcsh",
    "cmd", "command", "powershell", "pwsh",
];

/// Dangerous patterns that indicate command injection
const DANGEROUS_PATTERNS: &[&str] = &[
    ";", "&&", "||", "|", "&", 
    "$", "`", "$(", "${",
    ">", ">>", "<",
    "..", "../", "..\\",
    "~/", "~\\",
];

/// Validates a command for safety
pub fn validate_command(command: &str) -> Result<String, TerminalSecurityError> {
    if command.is_empty() {
        return Err(TerminalSecurityError {
            code: SecurityErrorCode::InvalidCharacters,
            message: "Command is empty".to_string(),
            details: None,
        });
    }

    // Check for dangerous patterns
    let lower_cmd = command.to_lowercase();
    for pattern in DANGEROUS_PATTERNS {
        if lower_cmd.contains(pattern) {
            return Err(TerminalSecurityError {
                code: SecurityErrorCode::CommandInjection,
                message: format!("Command contains dangerous pattern: {}", pattern),
                details: Some(serde_json::json!({ "pattern": pattern })),
            });
        }
    }

    // Check for blocked commands
    let first_word = command.split_whitespace().next().unwrap_or("").to_lowercase();
    if BLOCKED_COMMANDS.contains(&first_word.as_str()) {
        return Err(TerminalSecurityError {
            code: SecurityErrorCode::DangerousCommand,
            message: format!("Command '{}' is not allowed for security reasons", first_word),
            details: Some(serde_json::json!({ "command": first_word })),
        });
    }

    Ok(command.to_string())
}

/// Sanitizes a command string, removing dangerous characters
pub fn sanitize_command(command: &str) -> String {
    command
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || "-_." .contains(*c))
        .collect()
}

// ============================================================================
// XSS Prevention
// ============================================================================

/// HTML escape map for XSS prevention
fn escape_html_char(c: char) -> &'static str {
    match c {
        '&' => "&amp;",
        '<' => "&lt;",
        '>' => "&gt;",
        '"' => "&quot;",
        '\'' => "&#x27;",
        '/' => "&#x2F;",
        '`' => "&#x60;",
        '=' => "&#x3D;",
        _ => "",
    }
}

/// Escapes HTML special characters
pub fn escape_html(input: &str) -> String {
    let mut result = String::with_capacity(input.len() * 2);
    for c in input.chars() {
        let escaped = escape_html_char(c);
        if escaped.is_empty() {
            result.push(c);
        } else {
            result.push_str(escaped);
        }
    }
    result
}

/// Sanitizes terminal output for safe display
pub fn sanitize_terminal_output(output: &str) -> String {
    let mut sanitized = escape_html(output);
    
    // Remove OSC sequences that could be dangerous
    let osc_pattern = regex::Regex::new(r"\x1b\][0-9]+;[^\x1b]*(?:|\x1b\\)").unwrap();
    sanitized = osc_pattern.replace_all(&sanitized, "").to_string();
    
    sanitized
}

// ============================================================================
// Rate Limiting
// ============================================================================

#[derive(Debug, Clone)]
struct RateLimitEntry {
    count: u32,
    window_start: Instant,
}

/// Rate limiter for terminal commands
pub struct RateLimiter {
    limits: Arc<RwLock<HashMap<String, RateLimitEntry>>>,
    window_duration: Duration,
    max_requests: u32,
}

impl RateLimiter {
    pub fn new(window_secs: u64, max_requests: u32) -> Self {
        Self {
            limits: Arc::new(RwLock::new(HashMap::new())),
            window_duration: Duration::from_secs(window_secs),
            max_requests,
        }
    }

    pub async fn is_allowed(&self, key: &str) -> (bool, u32, Duration) {
        let mut limits = self.limits.write().await;
        let now = Instant::now();

        if let Some(entry) = limits.get_mut(key) {
            if now.duration_since(entry.window_start) > self.window_duration {
                // New window
                entry.count = 1;
                entry.window_start = now;
                let remaining = self.max_requests - 1;
                let reset_in = self.window_duration;
                return (true, remaining, reset_in);
            }

            if entry.count >= self.max_requests {
                // Rate limited
                let reset_in = self.window_duration - now.duration_since(entry.window_start);
                return (false, 0, reset_in);
            }

            // Increment count
            entry.count += 1;
            let remaining = self.max_requests - entry.count;
            let reset_in = self.window_duration - now.duration_since(entry.window_start);
            return (true, remaining, reset_in);
        }

        // New entry
        limits.insert(key.to_string(), RateLimitEntry {
            count: 1,
            window_start: now,
        });
        
        let remaining = self.max_requests - 1;
        (true, remaining, self.window_duration)
    }

    pub async fn reset(&self, key: &str) {
        let mut limits = self.limits.write().await;
        limits.remove(key);
    }

    /// Clean up old entries to prevent memory leaks
    pub async fn cleanup(&self) {
        let mut limits = self.limits.write().await;
        let now = Instant::now();
        limits.retain(|_, entry| {
            now.duration_since(entry.window_start) <= self.window_duration
        });
    }
}

// Global rate limiter instance
lazy_static::lazy_static! {
    pub static ref TERMINAL_RATE_LIMITER: RateLimiter = RateLimiter::new(
        RATE_LIMIT_WINDOW_SECS,
        MAX_COMMANDS_PER_WINDOW
    );
}

// ============================================================================
// Resource Limits
// ============================================================================

/// Tracks resource usage for a terminal session
pub struct ResourceTracker {
    buffer_size: usize,
    line_count: usize,
    last_activity: Instant,
    max_buffer_size: usize,
    max_lines: usize,
    timeout: Duration,
}

impl ResourceTracker {
    pub fn new() -> Self {
        Self {
            buffer_size: 0,
            line_count: 0,
            last_activity: Instant::now(),
            max_buffer_size: MAX_OUTPUT_BUFFER_SIZE,
            max_lines: MAX_OUTPUT_LINES,
            timeout: Duration::from_secs(COMMAND_TIMEOUT_SECS),
        }
    }

    pub fn can_add_data(&self, data: &str) -> Result<(), TerminalSecurityError> {
        let now = Instant::now();
        
        // Check timeout
        if now.duration_since(self.last_activity) > self.timeout {
            return Err(TerminalSecurityError {
                code: SecurityErrorCode::Timeout,
                message: "Command timed out".to_string(),
                details: None,
            });
        }

        // Check buffer size
        let new_size = self.buffer_size + data.len();
        if new_size > self.max_buffer_size {
            return Err(TerminalSecurityError {
                code: SecurityErrorCode::BufferOverflow,
                message: "Output buffer size limit exceeded".to_string(),
                details: Some(serde_json::json!({
                    "current_size": self.buffer_size,
                    "additional": data.len(),
                    "max": self.max_buffer_size
                })),
            });
        }

        // Check line count
        let new_lines = data.lines().count();
        if self.line_count + new_lines > self.max_lines {
            return Err(TerminalSecurityError {
                code: SecurityErrorCode::BufferOverflow,
                message: "Output line limit exceeded".to_string(),
                details: Some(serde_json::json!({
                    "current_lines": self.line_count,
                    "additional": new_lines,
                    "max": self.max_lines
                })),
            });
        }

        Ok(())
    }

    pub fn add_data(&mut self, data: &str) {
        self.buffer_size += data.len();
        self.line_count += data.lines().count();
        self.last_activity = Instant::now();
    }

    pub fn truncate_if_needed(&mut self, buffer: &mut String) {
        // Truncate by lines first
        if self.line_count > self.max_lines {
            let lines: Vec<&str> = buffer.lines().collect();
            let truncated = lines[lines.len().saturating_sub(self.max_lines)..].join("\n");
            *buffer = truncated;
            self.line_count = self.max_lines;
        }

        // Then by size
        if buffer.len() > self.max_buffer_size {
            let start = buffer.len() - self.max_buffer_size;
            *buffer = buffer[start..].to_string();
            self.buffer_size = buffer.len();
        }
    }

    pub fn reset(&mut self) {
        self.buffer_size = 0;
        self.line_count = 0;
        self.last_activity = Instant::now();
    }

    pub fn get_stats(&self) -> serde_json::Value {
        serde_json::json!({
            "buffer_size": self.buffer_size,
            "line_count": self.line_count,
            "last_activity": self.last_activity.elapsed().as_secs(),
        })
    }
}

// ============================================================================
// Session Management
// ============================================================================

/// Terminal session with security tracking
pub struct SecureTerminalSession {
    pub id: String,
    pub user_id: String,
    pub created_at: u64,
    pub last_activity: u64,
    pub is_authorized: bool,
    pub resource_tracker: ResourceTracker,
}

impl SecureTerminalSession {
    pub fn new(id: String, user_id: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        Self {
            id,
            user_id,
            created_at: now,
            last_activity: now,
            is_authorized: true,
            resource_tracker: ResourceTracker::new(),
        }
    }

    pub fn touch(&mut self) {
        self.last_activity = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }

    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now - self.last_activity > SESSION_TIMEOUT_SECS
    }
}

/// Manages secure terminal sessions
pub struct SecureSessionManager {
    sessions: Arc<RwLock<HashMap<String, SecureTerminalSession>>>,
}

impl SecureSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_session(&self, id: String, user_id: String) -> SecureTerminalSession {
        let session = SecureTerminalSession::new(id.clone(), user_id);
        let mut sessions = self.sessions.write().await;
        sessions.insert(id, session.clone());
        session
    }

    pub async fn get_session(&self, id: &str) -> Option<SecureTerminalSession> {
        let mut sessions = self.sessions.write().await;
        
        if let Some(session) = sessions.get_mut(id) {
            if session.is_expired() {
                sessions.remove(id);
                return None;
            }
            session.touch();
            return Some(session.clone());
        }
        
        None
    }

    pub async fn is_authorized(&self, session_id: &str) -> bool {
        if let Some(session) = self.get_session(session_id).await {
            session.is_authorized
        } else {
            false
        }
    }

    pub async fn close_session(&self, id: &str) {
        let mut sessions = self.sessions.write().await;
        sessions.remove(id);
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired(&self) {
        let mut sessions = self.sessions.write().await;
        let expired: Vec<String> = sessions
            .iter()
            .filter(|(_, session)| session.is_expired())
            .map(|(id, _)| id.clone())
            .collect();
        
        for id in expired {
            sessions.remove(&id);
        }
    }
}

impl Default for SecureSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for SecureTerminalSession {
    fn clone(&self) -> Self {
        Self {
            id: self.id.clone(),
            user_id: self.user_id.clone(),
            created_at: self.created_at,
            last_activity: self.last_activity,
            is_authorized: self.is_authorized,
            resource_tracker: ResourceTracker::new(), // New tracker for clone
        }
    }
}

// ============================================================================
// Path Sanitization
// ============================================================================

/// Sanitizes a file path to prevent path traversal attacks
pub fn sanitize_file_path(path: &str) -> String {
    path.replace("..", "")
        .replace("../", "")
        .replace("..\\", "")
        .replace('~', "")
        .replace("~/", "")
        .replace("~\\", "")
        .trim_start_matches('/')
        .trim_start_matches('\\')
        .to_string()
}

// ============================================================================
// WebSocket Security
// ============================================================================

/// Validates a WebSocket URL for security
pub fn validate_websocket_url(url: &str) -> Result<(bool, bool), TerminalSecurityError> {
    use url::Url;
    
    let parsed = Url::parse(url).map_err(|_| TerminalSecurityError {
        code: SecurityErrorCode::InvalidCharacters,
        message: "Invalid URL format".to_string(),
        details: None,
    })?;

    // Check protocol
    let is_secure = match parsed.scheme() {
        "wss" => true,
        "ws" => false,
        _ => {
            return Err(TerminalSecurityError {
                code: SecurityErrorCode::InvalidCharacters,
                message: "Invalid WebSocket protocol".to_string(),
                details: None,
            });
        }
    };

    // In production, require WSS
    if !is_secure && std::env::var("RUST_ENV").unwrap_or_default() == "production" {
        return Err(TerminalSecurityError {
            code: SecurityErrorCode::Unauthorized,
            message: "WSS required in production".to_string(),
            details: None,
        });
    }

    Ok((true, is_secure))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_input() {
        let input = "hello\x00world";
        let result = sanitize_terminal_input(input).unwrap();
        assert!(!result.contains('\0'));
    }

    #[test]
    fn test_validate_command_safe() {
        let cmd = "ls -la";
        assert!(validate_command(cmd).is_ok());
    }

    #[test]
    fn test_validate_command_dangerous() {
        let cmd = "rm -rf /";
        assert!(validate_command(cmd).is_err());
    }

    #[test]
    fn test_escape_html() {
        let input = "<script>alert('xss')</script>";
        let result = escape_html(input);
        assert!(!result.contains('<'));
        assert!(result.contains("&lt;"));
    }

    #[test]
    fn test_sanitize_file_path() {
        let path = "../../../etc/passwd";
        let result = sanitize_file_path(path);
        assert!(!result.contains(".."));
    }
}

//! Security Audit Logging Module
//!
//! Provides comprehensive audit logging for security events.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

use crate::Severity;

/// Security audit event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAuditEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
    pub client_ip: String,
    pub request_path: String,
    pub severity: Severity,
    pub details: String,
}

impl SecurityAuditEvent {
    /// Create a new security audit event
    pub fn new(
        event_type: impl Into<String>,
        client_ip: impl Into<String>,
        request_path: impl Into<String>,
        severity: Severity,
        details: impl Into<String>,
    ) -> Self {
        Self {
            timestamp: Utc::now(),
            event_type: event_type.into(),
            client_ip: client_ip.into(),
            request_path: request_path.into(),
            severity,
            details: details.into(),
        }
    }

    /// Create authentication event
    pub fn authentication(
        client_ip: impl Into<String>,
        user_id: impl Into<String>,
        success: bool,
    ) -> Self {
        Self::new(
            "authentication",
            client_ip,
            "/auth",
            if success {
                Severity::Info
            } else {
                Severity::Warning
            },
            format!(
                "User {} authentication {}",
                user_id.into(),
                if success { "succeeded" } else { "failed" }
            ),
        )
    }

    /// Create authorization event
    pub fn authorization(
        client_ip: impl Into<String>,
        user_id: impl Into<String>,
        resource: impl Into<String>,
        action: impl Into<String>,
        granted: bool,
    ) -> Self {
        let resource_str: String = resource.into();
        let user_id_str: String = user_id.into();
        let action_str: String = action.into();
        Self::new(
            "authorization",
            client_ip,
            resource_str.clone(),
            if granted {
                Severity::Info
            } else {
                Severity::Warning
            },
            format!(
                "User {} {} {} on {}",
                user_id_str,
                if granted { "granted" } else { "denied" },
                action_str,
                resource_str
            ),
        )
    }

    /// Create data access event
    pub fn data_access(
        client_ip: impl Into<String>,
        user_id: impl Into<String>,
        data_type: impl Into<String>,
        action: impl Into<String>,
    ) -> Self {
        Self::new(
            "data_access",
            client_ip,
            "/data",
            Severity::Info,
            format!(
                "User {} performed {} on {}",
                user_id.into(),
                action.into(),
                data_type.into()
            ),
        )
    }

    /// Create configuration change event
    pub fn config_change(
        client_ip: impl Into<String>,
        user_id: impl Into<String>,
        config_key: impl Into<String>,
        old_value: impl Into<String>,
        new_value: impl Into<String>,
    ) -> Self {
        Self::new(
            "config_change",
            client_ip,
            "/config",
            Severity::Warning,
            format!(
                "User {} changed {} from '{}' to '{}'",
                user_id.into(),
                config_key.into(),
                old_value.into(),
                new_value.into()
            ),
        )
    }
}

/// Audit logger configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AuditConfig {
    /// Maximum number of events to keep in memory
    pub max_in_memory_events: usize,
    /// Whether to log to stdout
    pub log_to_stdout: bool,
    /// Whether to log to file
    pub log_to_file: bool,
    /// Log file path (if log_to_file is true)
    pub log_file_path: String,
    /// Minimum severity to log
    pub min_severity: Severity,
}

impl Default for AuditConfig {
    fn default() -> Self {
        Self {
            max_in_memory_events: 10000,
            log_to_stdout: true,
            log_to_file: false,
            log_file_path: "/var/log/allternit/security_audit.log".to_string(),
            min_severity: Severity::Info,
        }
    }
}

/// Audit logger
pub struct AuditLogger {
    config: AuditConfig,
    events: Arc<RwLock<VecDeque<SecurityAuditEvent>>>,
}

impl AuditLogger {
    /// Create a new audit logger
    pub fn new() -> Self {
        Self::with_config(AuditConfig::default())
    }

    /// Create with configuration
    pub fn with_config(config: AuditConfig) -> Self {
        Self {
            config,
            events: Arc::new(RwLock::new(VecDeque::new())),
        }
    }

    /// Log a security event
    pub async fn log(&self, event: SecurityAuditEvent) {
        // Check severity threshold
        if (event.severity as i32) < (self.config.min_severity as i32) {
            return;
        }

        // Store in memory
        let mut events = self.events.write().await;
        events.push_back(event.clone());

        // Trim if exceeds max
        while events.len() > self.config.max_in_memory_events {
            events.pop_front();
        }

        drop(events);

        // Log to stdout
        if self.config.log_to_stdout {
            self.log_to_stdout(&event);
        }

        // Log to file
        if self.config.log_to_file {
            if let Err(e) = self.log_to_file(&event).await {
                eprintln!("Failed to write audit log: {}", e);
            }
        }
    }

    /// Log to stdout using tracing
    fn log_to_stdout(&self, event: &SecurityAuditEvent) {
        let json = serde_json::to_string(event).unwrap_or_default();

        match event.severity {
            Severity::Debug => tracing::debug!("SECURITY: {}", json),
            Severity::Info => info!("SECURITY: {}", json),
            Severity::Warning => warn!("SECURITY: {}", json),
            Severity::Error => error!("SECURITY: {}", json),
            Severity::Critical => error!("SECURITY-CRITICAL: {}", json),
        }
    }

    /// Log to file
    async fn log_to_file(&self, event: &SecurityAuditEvent) -> std::io::Result<()> {
        use tokio::io::AsyncWriteExt;

        let json = serde_json::to_string(event).unwrap_or_default();
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.config.log_file_path)
            .await?;

        file.write_all(json.as_bytes()).await?;
        file.write_all(b"\n").await?;
        file.flush().await?;

        Ok(())
    }

    /// Get recent events
    pub async fn get_recent_events(&self, count: usize) -> Vec<SecurityAuditEvent> {
        let events = self.events.read().await;
        events.iter().rev().take(count).cloned().collect()
    }

    /// Get events by severity
    pub async fn get_events_by_severity(&self, severity: Severity) -> Vec<SecurityAuditEvent> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.severity == severity)
            .cloned()
            .collect()
    }

    /// Get events by type
    pub async fn get_events_by_type(&self, event_type: &str) -> Vec<SecurityAuditEvent> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.event_type == event_type)
            .cloned()
            .collect()
    }

    /// Clear all events
    pub async fn clear(&self) {
        let mut events = self.events.write().await;
        events.clear();
    }

    /// Get event count
    pub async fn event_count(&self) -> usize {
        let events = self.events.read().await;
        events.len()
    }
}

impl Default for AuditLogger {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for AuditLogger {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            events: self.events.clone(),
        }
    }
}

/// Audit query builder
pub struct AuditQuery {
    event_type: Option<String>,
    severity: Option<Severity>,
    client_ip: Option<String>,
    start_time: Option<DateTime<Utc>>,
    end_time: Option<DateTime<Utc>>,
    limit: usize,
}

impl AuditQuery {
    pub fn new() -> Self {
        Self {
            event_type: None,
            severity: None,
            client_ip: None,
            start_time: None,
            end_time: None,
            limit: 100,
        }
    }

    pub fn event_type(mut self, event_type: impl Into<String>) -> Self {
        self.event_type = Some(event_type.into());
        self
    }

    pub fn severity(mut self, severity: Severity) -> Self {
        self.severity = Some(severity);
        self
    }

    pub fn client_ip(mut self, ip: impl Into<String>) -> Self {
        self.client_ip = Some(ip.into());
        self
    }

    pub fn start_time(mut self, time: DateTime<Utc>) -> Self {
        self.start_time = Some(time);
        self
    }

    pub fn end_time(mut self, time: DateTime<Utc>) -> Self {
        self.end_time = Some(time);
        self
    }

    pub fn limit(mut self, limit: usize) -> Self {
        self.limit = limit;
        self
    }

    /// Execute query against logger
    pub async fn execute(&self, logger: &AuditLogger) -> Vec<SecurityAuditEvent> {
        let events = logger.events.read().await;

        events
            .iter()
            .filter(|e| {
                if let Some(ref event_type) = self.event_type {
                    if e.event_type != *event_type {
                        return false;
                    }
                }

                if let Some(severity) = self.severity {
                    if e.severity != severity {
                        return false;
                    }
                }

                if let Some(ref client_ip) = self.client_ip {
                    if e.client_ip != *client_ip {
                        return false;
                    }
                }

                if let Some(start) = self.start_time {
                    if e.timestamp < start {
                        return false;
                    }
                }

                if let Some(end) = self.end_time {
                    if e.timestamp > end {
                        return false;
                    }
                }

                true
            })
            .rev()
            .take(self.limit)
            .cloned()
            .collect()
    }
}

impl Default for AuditQuery {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_audit_logger() {
        let logger = AuditLogger::new();

        // Log some events
        logger
            .log(SecurityAuditEvent::authentication(
                "127.0.0.1",
                "user1",
                true,
            ))
            .await;
        logger
            .log(SecurityAuditEvent::authentication(
                "127.0.0.1",
                "user2",
                false,
            ))
            .await;
        logger
            .log(SecurityAuditEvent::data_access(
                "127.0.0.1",
                "user1",
                "user_data",
                "read",
            ))
            .await;

        // Check count
        assert_eq!(logger.event_count().await, 3);

        // Get recent events
        let recent = logger.get_recent_events(2).await;
        assert_eq!(recent.len(), 2);

        // Get by severity
        let warnings = logger.get_events_by_severity(Severity::Warning).await;
        assert_eq!(warnings.len(), 1);

        // Get by type
        let auth_events = logger.get_events_by_type("authentication").await;
        assert_eq!(auth_events.len(), 2);
    }

    #[tokio::test]
    async fn test_audit_query() {
        let logger = AuditLogger::new();

        logger
            .log(SecurityAuditEvent::authentication(
                "127.0.0.1",
                "user1",
                true,
            ))
            .await;
        logger
            .log(SecurityAuditEvent::authentication(
                "127.0.0.2",
                "user2",
                false,
            ))
            .await;

        // Query by client IP
        let results = AuditQuery::new()
            .client_ip("127.0.0.1")
            .execute(&logger)
            .await;

        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn test_max_events_limit() {
        let config = AuditConfig {
            max_in_memory_events: 5,
            log_to_stdout: false,
            ..Default::default()
        };

        let logger = AuditLogger::with_config(config);

        // Log more than max events
        for i in 0..10 {
            logger
                .log(SecurityAuditEvent::authentication(
                    "127.0.0.1",
                    format!("user{}", i),
                    true,
                ))
                .await;
        }

        // Should only have max events
        assert_eq!(logger.event_count().await, 5);
    }
}

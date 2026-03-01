//! Inter-Agent Message Bus
//!
//! Provides typed message passing between agents with:
//! - Message typing and logging
//! - Publish/subscribe pattern
//! - Message persistence

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{broadcast, RwLock};
use tracing::info;

use crate::{AgentId, MessageId};

/// Agent message with typed payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: MessageId,
    pub from: AgentId,
    pub to: AgentId,
    pub kind: MessageKind,
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Types of messages between agents
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageKind {
    /// Request for action or information
    Request,
    /// Response to a request
    Response,
    /// Notification (no response expected)
    Notification,
    /// Event broadcast
    Event,
    /// Command (must be executed)
    Command,
}

/// Message log entry for auditing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageLogEntry {
    pub message_id: MessageId,
    pub from: AgentId,
    pub to: AgentId,
    pub kind: MessageKind,
    pub timestamp: DateTime<Utc>,
    pub success: bool,
    pub latency_ms: Option<u64>,
}

/// Message statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageStats {
    pub messages_sent: u64,
    pub messages_received: u64,
    pub messages_failed: u64,
    pub avg_latency_ms: f64,
}

/// Message bus error
#[derive(Debug, Error)]
pub enum MessageBusError {
    #[error("Subscriber not found: {0}")]
    SubscriberNotFound(AgentId),

    #[error("Message send failed: {0}")]
    SendFailed(String),

    #[error("Channel closed")]
    ChannelClosed,
}

/// Inter-agent message bus
pub struct MessageBus {
    channels: Arc<RwLock<HashMap<AgentId, broadcast::Sender<AgentMessage>>>>,
    log: Arc<RwLock<Vec<MessageLogEntry>>>,
    stats: Arc<RwLock<MessageStats>>,
}

impl MessageBus {
    /// Create a new message bus
    pub fn new() -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            log: Arc::new(RwLock::new(Vec::new())),
            stats: Arc::new(RwLock::new(MessageStats {
                messages_sent: 0,
                messages_received: 0,
                messages_failed: 0,
                avg_latency_ms: 0.0,
            })),
        }
    }

    /// Send a message to an agent
    pub async fn send(
        &self,
        from: &AgentId,
        to: &AgentId,
        message: AgentMessage,
    ) -> Result<MessageId, MessageBusError> {
        let start = std::time::Instant::now();
        let message_id = message.id.clone();

        // Get or create channel for recipient
        let sender = {
            let channels = self.channels.read().await;
            channels.get(to).cloned()
        };

        let sender = match sender {
            Some(s) => s,
            None => {
                // Create channel for new agent
                let (tx, _rx) = broadcast::channel(1000);
                let mut channels = self.channels.write().await;
                channels.entry(to.clone()).or_insert(tx.clone());
                tx
            }
        };

        // Send message
        match sender.send(message.clone()) {
            Ok(_) => {
                // Update stats
                let latency = start.elapsed().as_millis() as u64;
                let mut stats = self.stats.write().await;
                stats.messages_sent += 1;
                stats.avg_latency_ms = (stats.avg_latency_ms * stats.messages_sent as f64
                    + latency as f64)
                    / (stats.messages_sent as f64 + 1.0);

                // Log message
                let mut log = self.log.write().await;
                log.push(MessageLogEntry {
                    message_id: message_id.clone(),
                    from: from.clone(),
                    to: to.clone(),
                    kind: message.kind,
                    timestamp: Utc::now(),
                    success: true,
                    latency_ms: Some(latency),
                });

                info!(
                    "Message {} sent from {} to {} ({}ms)",
                    message_id, from, to, latency
                );
                Ok(message_id)
            }
            Err(broadcast::error::SendError(_)) => {
                // Update failed stats
                let mut stats = self.stats.write().await;
                stats.messages_failed += 1;

                // Log failure
                let mut log = self.log.write().await;
                log.push(MessageLogEntry {
                    message_id: message_id.clone(),
                    from: from.clone(),
                    to: to.clone(),
                    kind: message.kind,
                    timestamp: Utc::now(),
                    success: false,
                    latency_ms: None,
                });

                Err(MessageBusError::ChannelClosed)
            }
        }
    }

    /// Subscribe to messages for an agent
    pub async fn subscribe(&self, agent_id: &AgentId) -> broadcast::Receiver<AgentMessage> {
        let mut channels = self.channels.write().await;

        let sender = channels
            .entry(agent_id.clone())
            .or_insert_with(|| broadcast::channel(1000).0);

        sender.subscribe()
    }

    /// Get message statistics
    pub async fn get_stats(&self) -> MessageStats {
        self.stats.read().await.clone()
    }

    /// Get message log (last N entries)
    pub async fn get_log(&self, limit: usize) -> Vec<MessageLogEntry> {
        let log = self.log.read().await;
        log.iter().rev().take(limit).cloned().collect()
    }

    /// Clear message log
    pub async fn clear_log(&self) {
        let mut log = self.log.write().await;
        log.clear();
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{timeout, Duration};

    #[tokio::test]
    async fn test_message_bus_creation() {
        let bus = MessageBus::new();
        let stats = bus.get_stats().await;
        assert_eq!(stats.messages_sent, 0);
    }

    #[tokio::test]
    async fn test_send_and_receive() {
        let bus = MessageBus::new();
        let from = "sender".to_string();
        let to = "receiver".to_string();

        // Subscribe before sending
        let mut rx = bus.subscribe(&to).await;

        let message = AgentMessage {
            id: "test_msg".to_string(),
            from: from.clone(),
            to: to.clone(),
            kind: MessageKind::Request,
            payload: serde_json::json!({"key": "value"}),
            created_at: Utc::now(),
        };

        // Send message
        let result = bus.send(&from, &to, message.clone()).await;
        assert!(result.is_ok());

        // Receive message
        let received = timeout(Duration::from_millis(100), rx.recv())
            .await
            .expect("Timeout")
            .expect("Channel closed");

        assert_eq!(received.id, message.id);
        assert_eq!(received.from, from);
        assert_eq!(received.to, to);
    }

    #[tokio::test]
    async fn test_message_stats() {
        let bus = MessageBus::new();

        // Subscribe first to ensure channel exists
        let _rx = bus.subscribe(&"receiver".to_string()).await;

        for i in 0..5 {
            let message = AgentMessage {
                id: format!("msg_{}", i),
                from: "sender".to_string(),
                to: "receiver".to_string(),
                kind: MessageKind::Notification,
                payload: serde_json::json!({}),
                created_at: Utc::now(),
            };

            let _ = bus
                .send(&"sender".to_string(), &"receiver".to_string(), message)
                .await;
        }

        let stats = bus.get_stats().await;
        assert_eq!(stats.messages_sent, 5);
        assert_eq!(stats.messages_failed, 0);
    }

    #[tokio::test]
    async fn test_message_log() {
        let bus = MessageBus::new();

        // Subscribe first to ensure channel exists
        let _rx = bus.subscribe(&"receiver".to_string()).await;

        let message = AgentMessage {
            id: "logged_msg".to_string(),
            from: "sender".to_string(),
            to: "receiver".to_string(),
            kind: MessageKind::Event,
            payload: serde_json::json!({}),
            created_at: Utc::now(),
        };

        let _ = bus
            .send(&"sender".to_string(), &"receiver".to_string(), message)
            .await;

        let log = bus.get_log(10).await;
        assert!(!log.is_empty());
        if !log.is_empty() {
            assert_eq!(log[0].message_id, "logged_msg");
            assert!(log[0].success);
        }
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let bus = MessageBus::new();
        let agent = "multi_sub".to_string();

        // Create multiple subscribers
        let mut rx1 = bus.subscribe(&agent).await;
        let mut rx2 = bus.subscribe(&agent).await;

        let message = AgentMessage {
            id: "broadcast".to_string(),
            from: "sender".to_string(),
            to: agent.clone(),
            kind: MessageKind::Event,
            payload: serde_json::json!({"broadcast": true}),
            created_at: Utc::now(),
        };

        let _ = bus
            .send(&"sender".to_string(), &agent, message.clone())
            .await;

        // Both subscribers should receive
        let r1 = timeout(Duration::from_millis(100), rx1.recv())
            .await
            .expect("Timeout 1")
            .expect("Closed 1");
        let r2 = timeout(Duration::from_millis(100), rx2.recv())
            .await
            .expect("Timeout 2")
            .expect("Closed 2");

        assert_eq!(r1.id, message.id);
        assert_eq!(r2.id, message.id);
    }
}

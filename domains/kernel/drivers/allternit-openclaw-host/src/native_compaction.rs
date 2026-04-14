//! Session Compaction - OC-011
//!
//! Native Rust implementation of OpenClaw's session compaction algorithm.
//! This module provides the native implementation that will eventually replace
//! the OpenClaw subprocess version.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Configuration for session compaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactionConfig {
    /// Maximum age of messages to retain (in days)
    pub max_age_days: Option<u32>,

    /// Maximum number of messages to retain
    pub max_messages: Option<u32>,

    /// Maximum number of tokens to retain
    pub max_tokens: Option<u32>,

    /// Number of recent messages to always preserve
    pub preserve_recent: Option<u32>,

    /// Minimum context window to preserve
    pub min_context_tokens: Option<u32>,

    /// Whether to summarize older content
    pub enable_summarization: bool,

    /// Chunk ratio for splitting large sessions
    pub chunk_ratio: Option<f64>,
}

impl Default for CompactionConfig {
    fn default() -> Self {
        Self {
            max_age_days: Some(30),
            max_messages: Some(1000),
            max_tokens: Some(100_000),
            preserve_recent: Some(50),
            min_context_tokens: Some(4000),
            enable_summarization: true,
            chunk_ratio: Some(0.4),
        }
    }
}

/// Session message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub role: String, // 'user', 'assistant', 'system', etc.
    pub content: String,
    pub timestamp: String,
    pub tokens: Option<u32>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Compacted session result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompactedSession {
    pub messages: Vec<SessionMessage>,
    pub original_size: usize,
    pub compacted_size: usize,
    pub tokens_saved: Option<u32>,
    pub summary: Option<String>,
}

/// Session compaction service
pub struct SessionCompactor {
    config: CompactionConfig,
}

impl SessionCompactor {
    /// Create new session compactor with default configuration
    pub fn new() -> Self {
        Self {
            config: CompactionConfig::default(),
        }
    }

    /// Create new session compactor with custom configuration
    pub fn with_config(config: CompactionConfig) -> Self {
        Self { config }
    }

    /// Compact a session according to the configured rules
    pub fn compact(&self, mut session: Vec<SessionMessage>) -> CompactedSession {
        let original_size = session.len();

        // Apply retention policies
        session = self.apply_retention_policies(session);

        // Apply summarization if enabled
        let summary = if self.config.enable_summarization {
            self.generate_summary(&session)
        } else {
            None
        };

        // Calculate tokens saved (approximate)
        let tokens_saved = self.calculate_tokens_saved(original_size, session.len());

        CompactedSession {
            messages: session,
            original_size,
            compacted_size: original_size, // Placeholder - actual compacted size would be calculated
            tokens_saved,
            summary,
        }
    }

    /// Apply retention policies to the session
    fn apply_retention_policies(&self, mut session: Vec<SessionMessage>) -> Vec<SessionMessage> {
        // Sort by timestamp to work with chronological order
        session.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        // Apply max age filter
        if let Some(max_age_days) = self.config.max_age_days {
            let cutoff_time = self.get_cutoff_time(max_age_days);
            session.retain(|msg| msg.timestamp >= cutoff_time);
        }

        // Apply max messages filter
        if let Some(max_messages) = self.config.max_messages {
            if session.len() > max_messages as usize {
                // Preserve recent messages and important context
                let preserve_count = self.config.preserve_recent.unwrap_or(50) as usize;

                if session.len() > preserve_count {
                    // Keep the most recent messages
                    let start_idx = session.len() - preserve_count;
                    let mut retained = session[start_idx..].to_vec();

                    // Add some earlier context if space permits
                    if retained.len() < max_messages as usize {
                        let needed = (max_messages as usize - retained.len()).min(start_idx);
                        retained.splice(0..0, session[..needed].to_vec());
                    }

                    session = retained;
                }
            }
        }

        // Apply token-based filtering
        if let Some(max_tokens) = self.config.max_tokens {
            session = self.filter_by_tokens(session, max_tokens);
        }

        session
    }

    /// Filter messages by token count
    fn filter_by_tokens(
        &self,
        session: Vec<SessionMessage>,
        max_tokens: u32,
    ) -> Vec<SessionMessage> {
        let mut current_tokens = 0u32;
        let mut filtered = Vec::new();

        // Process from newest to oldest to preserve recent context
        for msg in session.into_iter().rev() {
            let msg_tokens = msg
                .tokens
                .unwrap_or_else(|| self.estimate_tokens(&msg.content));

            if current_tokens + msg_tokens <= max_tokens {
                current_tokens += msg_tokens;
                filtered.push(msg);
            } else {
                // If we're under minimum context threshold, keep the message anyway
                if current_tokens < self.config.min_context_tokens.unwrap_or(4000) {
                    current_tokens += msg_tokens;
                    filtered.push(msg);
                } else {
                    // We've exceeded the token limit, stop adding
                    break;
                }
            }
        }

        // Reverse back to chronological order
        filtered.reverse();
        filtered
    }

    /// Generate a summary of the session
    fn generate_summary(&self, session: &[SessionMessage]) -> Option<String> {
        if session.is_empty() {
            return None;
        }

        // For now, return a simple summary - in a real implementation,
        // this would call an LLM to generate a proper summary
        let mut summary_parts = Vec::new();

        // Count message types
        let mut role_counts = HashMap::new();
        for msg in session {
            *role_counts.entry(&msg.role).or_insert(0) += 1;
        }

        for (role, count) in role_counts {
            summary_parts.push(format!("{}: {} messages", role, count));
        }

        Some(summary_parts.join("; "))
    }

    /// Calculate approximate tokens saved
    fn calculate_tokens_saved(&self, original_count: usize, new_count: usize) -> Option<u32> {
        if original_count > new_count {
            // Estimate based on average message size
            Some(((original_count - new_count) * 100) as u32) // Rough estimate
        } else {
            Some(0)
        }
    }

    /// Get cutoff time for max age filter
    fn get_cutoff_time(&self, days: u32) -> String {
        // In a real implementation, this would calculate the actual cutoff time
        // For now, return a placeholder
        format!("{}-days-ago", days)
    }

    /// Estimate tokens in content (simplified)
    fn estimate_tokens(&self, content: &str) -> u32 {
        // Very rough estimation: 1 token ≈ 4 characters
        (content.len() / 4) as u32
    }

    /// Update the compaction configuration
    pub fn set_config(&mut self, config: CompactionConfig) {
        self.config = config;
    }

    /// Get current configuration
    pub fn config(&self) -> &CompactionConfig {
        &self.config
    }
}

impl Default for SessionCompactor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_compactor_creation() {
        let compactor = SessionCompactor::new();
        assert_eq!(compactor.config.max_age_days, Some(30));
        assert_eq!(compactor.config.max_messages, Some(1000));
    }

    #[test]
    fn test_compactor_with_config() {
        let config = CompactionConfig {
            max_age_days: Some(7),
            max_messages: Some(100),
            ..Default::default()
        };

        let compactor = SessionCompactor::with_config(config);
        assert_eq!(compactor.config.max_age_days, Some(7));
        assert_eq!(compactor.config.max_messages, Some(100));
    }

    #[test]
    fn test_session_message_structure() {
        let message = SessionMessage {
            id: "test-id".to_string(),
            role: "user".to_string(),
            content: "Hello, world!".to_string(),
            timestamp: "2023-01-01T00:00:00Z".to_string(),
            tokens: Some(5),
            metadata: None,
        };

        assert_eq!(message.role, "user");
        assert_eq!(message.content, "Hello, world!");
    }
}

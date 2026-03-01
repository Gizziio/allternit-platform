// packages/agents/src/lib.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub personality: String,
    pub default: bool,
    pub capabilities: Vec<String>,
    pub permissions: AgentPermissions,
    pub created_at: u64,
    pub updated_at: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPermissions {
    pub allowed_functions: Vec<String>,
    pub denied_functions: Vec<String>,
    pub confirmation_threshold: String, // "low", "medium", "high", "critical"
    pub max_daily_executions: Option<u32>,
    pub allowed_contexts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRouteRequest {
    pub message: String,
    pub user_id: String,
    pub context: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRouteResponse {
    pub agent_id: String,
    pub agent_name: String,
    pub confidence: f64,
    pub routing_reason: String,
}

pub struct AgentRouter {
    pub agents: HashMap<String, AgentDefinition>,
}

impl AgentRouter {
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
        }
    }

    pub fn add_agent(&mut self, agent: AgentDefinition) {
        self.agents.insert(agent.id.clone(), agent);
    }

    pub fn get_agent(&self, agent_id: &str) -> Option<&AgentDefinition> {
        self.agents.get(agent_id)
    }

    pub async fn route(&self, request: &AgentRouteRequest) -> Result<AgentRouteResponse, Box<dyn std::error::Error>> {
        // In a real implementation, this would use AI to determine the best agent
        // For now, we'll implement simple keyword-based routing
        
        let message_lower = request.message.to_lowercase();
        
        // Check for specific agent mentions
        if message_lower.contains("@assistant") || message_lower.contains("help") {
            if let Some(assistant_agent) = self.agents.values().find(|a| a.name.to_lowercase().contains("assistant")) {
                return Ok(AgentRouteResponse {
                    agent_id: assistant_agent.id.clone(),
                    agent_name: assistant_agent.name.clone(),
                    confidence: 0.9,
                    routing_reason: "Keyword match: help/assistant".to_string(),
                });
            }
        } else if message_lower.contains("@expert") || message_lower.contains("research") || message_lower.contains("analyze") {
            if let Some(expert_agent) = self.agents.values().find(|a| a.name.to_lowercase().contains("expert")) {
                return Ok(AgentRouteResponse {
                    agent_id: expert_agent.id.clone(),
                    agent_name: expert_agent.name.clone(),
                    confidence: 0.85,
                    routing_reason: "Keyword match: research/analyze/expert".to_string(),
                });
            }
        } else if message_lower.contains("@friend") || message_lower.contains("casual") || message_lower.contains("chat") {
            if let Some(friend_agent) = self.agents.values().find(|a| a.name.to_lowercase().contains("friend")) {
                return Ok(AgentRouteResponse {
                    agent_id: friend_agent.id.clone(),
                    agent_name: friend_agent.name.clone(),
                    confidence: 0.8,
                    routing_reason: "Keyword match: casual/chat/friend".to_string(),
                });
            }
        }
        
        // Default to the default agent if available
        if let Some(default_agent) = self.agents.values().find(|a| a.default) {
            return Ok(AgentRouteResponse {
                agent_id: default_agent.id.clone(),
                agent_name: default_agent.name.clone(),
                confidence: 0.7,
                routing_reason: "Default agent fallback".to_string(),
            });
        }
        
        // If no default agent, return the first available agent
        if let Some(first_agent) = self.agents.values().next() {
            return Ok(AgentRouteResponse {
                agent_id: first_agent.id.clone(),
                agent_name: first_agent.name.clone(),
                confidence: 0.6,
                routing_reason: "First available agent fallback".to_string(),
            });
        }
        
        // If no agents are available, return an error
        Err("No agents available for routing".into())
    }

    pub fn list_agents(&self) -> Vec<&AgentDefinition> {
        self.agents.values().collect()
    }

    pub fn get_agent_by_name(&self, name: &str) -> Option<&AgentDefinition> {
        self.agents.values().find(|agent| agent.name == name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_router_creation() {
        let router = AgentRouter::new();
        assert_eq!(router.agents.len(), 0);
    }

    #[tokio::test]
    async fn test_agent_routing_basic() {
        let mut router = AgentRouter::new();
        
        // Add a default agent
        let default_agent = AgentDefinition {
            id: "default_agent".to_string(),
            name: "Assistant".to_string(),
            description: "Default assistant agent".to_string(),
            version: "1.0.0".to_string(),
            personality: "helpful".to_string(),
            default: true,
            capabilities: vec!["general".to_string(), "chat".to_string()],
            permissions: AgentPermissions {
                allowed_functions: vec!["*".to_string()],
                denied_functions: vec![],
                confirmation_threshold: "medium".to_string(),
                max_daily_executions: None,
                allowed_contexts: vec!["all".to_string()],
            },
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            active: true,
        };
        
        router.add_agent(default_agent);
        
        let request = AgentRouteRequest {
            message: "Hello, how are you?".to_string(),
            user_id: "user123".to_string(),
            context: serde_json::json!({}),
        };
        
        let response = router.route(&request).await.unwrap();
        assert_eq!(response.agent_name, "Assistant");
        assert!(response.confidence > 0.5);
    }

    #[tokio::test]
    async fn test_agent_routing_explicit_mention() {
        let mut router = AgentRouter::new();
        
        // Add multiple agents
        let assistant_agent = AgentDefinition {
            id: "assistant_agent".to_string(),
            name: "Assistant".to_string(),
            description: "Helpful assistant".to_string(),
            version: "1.0.0".to_string(),
            personality: "professional".to_string(),
            default: false,
            capabilities: vec!["general".to_string(), "support".to_string()],
            permissions: AgentPermissions {
                allowed_functions: vec!["*".to_string()],
                denied_functions: vec![],
                confirmation_threshold: "medium".to_string(),
                max_daily_executions: None,
                allowed_contexts: vec!["all".to_string()],
            },
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            active: true,
        };
        
        let expert_agent = AgentDefinition {
            id: "expert_agent".to_string(),
            name: "Expert".to_string(),
            description: "Knowledge expert".to_string(),
            version: "1.0.0".to_string(),
            personality: "analytical".to_string(),
            default: false,
            capabilities: vec!["research".to_string(), "analysis".to_string()],
            permissions: AgentPermissions {
                allowed_functions: vec!["*".to_string()],
                denied_functions: vec![],
                confirmation_threshold: "high".to_string(),
                max_daily_executions: None,
                allowed_contexts: vec!["all".to_string()],
            },
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            active: true,
        };
        
        router.add_agent(assistant_agent);
        router.add_agent(expert_agent);
        
        // Test explicit agent mention
        let request = AgentRouteRequest {
            message: "@expert analyze this document".to_string(),
            user_id: "user123".to_string(),
            context: serde_json::json!({}),
        };
        
        let response = router.route(&request).await.unwrap();
        assert_eq!(response.agent_name, "Expert");
        assert!(response.confidence > 0.8);
    }

    #[tokio::test]
    async fn test_agent_routing_keyword_match() {
        let mut router = AgentRouter::new();
        
        let research_agent = AgentDefinition {
            id: "research_agent".to_string(),
            name: "Researcher".to_string(),
            description: "Research specialist".to_string(),
            version: "1.0.0".to_string(),
            personality: "analytical".to_string(),
            default: false,
            capabilities: vec!["research".to_string(), "analysis".to_string()],
            permissions: AgentPermissions {
                allowed_functions: vec!["*".to_string()],
                denied_functions: vec![],
                confirmation_threshold: "high".to_string(),
                max_daily_executions: None,
                allowed_contexts: vec!["all".to_string()],
            },
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            active: true,
        };
        
        router.add_agent(research_agent);
        
        // Test keyword-based routing
        let request = AgentRouteRequest {
            message: "Can you research quantum computing for me?".to_string(),
            user_id: "user123".to_string(),
            context: serde_json::json!({}),
        };
        
        let response = router.route(&request).await.unwrap();
        assert_eq!(response.agent_name, "Researcher");
        assert!(response.confidence > 0.8);
    }
}
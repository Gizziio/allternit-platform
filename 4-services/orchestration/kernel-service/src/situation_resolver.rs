use crate::types::{InteractionSpec, Situation};
use serde_json::json;

pub struct SituationResolver;

impl SituationResolver {
    pub fn resolve(intent: &str, framework_id: &str) -> Situation {
        let lower = intent.to_lowercase();

        let (situation_class, transition, recommended_actions) =
            if lower.contains("search") || lower.contains("find") {
                ("discovery", "modal", vec!["spawn_capsule", "pin"])
            } else if lower.contains("review") || lower.contains("fix") || lower.contains("diff") {
                (
                    "code_review",
                    "shared_element_push",
                    vec!["approve_patch", "spawn_subcapsule"],
                )
            } else if framework_id == "fwk_workorder" {
                (
                    "execution",
                    "shared_element_push",
                    vec!["escalate", "close"],
                )
            } else if lower.contains("plan") || lower.contains("goal") {
                ("planning", "push", vec!["add_step", "verify"])
            } else {
                ("general", "push", vec![])
            };

        let tokens = vec![
            json!({ "type": "verb", "value": situation_class }),
            json!({ "type": "context", "value": framework_id }),
            json!({ "type": "confidence", "value": 0.95 }),
        ];

        Situation {
            id: format!("sit_{}", uuid::Uuid::new_v4().to_string()[..8].to_string()),
            intent_tokens: tokens,
            interaction_spec: InteractionSpec {
                transition: transition.to_string(),
                importance: if situation_class == "code_review" {
                    "heavy".to_string()
                } else {
                    "normal".to_string()
                },
            },
        }
    }
}

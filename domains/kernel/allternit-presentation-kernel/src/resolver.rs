use crate::error::Result;
use crate::types::{CanvasSelection, JournalContext, RendererConstraints, Situation};

#[derive(Clone)]
pub struct SituationResolver {
    tokenizer: crate::tokenizer::IntentTokenizer,
}

impl Default for SituationResolver {
    fn default() -> Self {
        Self::new()
    }
}

impl SituationResolver {
    pub fn new() -> Self {
        Self {
            tokenizer: crate::tokenizer::IntentTokenizer::new(),
        }
    }

    pub async fn resolve_situation(
        &self,
        input: &str,
        journal_context: JournalContext,
    ) -> Result<Situation> {
        let tokens = self.tokenizer.tokenize(input).await?;

        let renderer_constraints = RendererConstraints {
            renderer_type: "web".to_string(),
            capabilities: vec!["interactive".to_string(), "animation".to_string()],
        };

        let active_capsules = journal_context.active_capsules.clone();

        let situation = Situation {
            situation_id: uuid::Uuid::new_v4(),
            tokens,
            journal_context,
            active_capsules,
            renderer_constraints,
        };

        Ok(situation)
    }

    pub async fn select_canvas(&self, canvas_type: &str) -> Result<Option<CanvasSelection>> {
        match canvas_type {
            "empty_view" | "list_view" => Ok(Some(CanvasSelection {
                canvas_spec: crate::types::CanvasSpec {
                    canvas_id: uuid::Uuid::new_v4(),
                    title: "Empty View".to_string(),
                    views: vec![],
                    layout_strategy: None,
                    interaction_spec: None,
                    theme: None,
                    permissions: None,
                    metadata: None,
                },
                primary: true,
            })),
            _ => Ok(None),
        }
    }
}

#[cfg(feature = "native-llama")]
mod native {
    use anyhow::Result;
    use llama_cpp_2::context::LlamaContext;
    use llama_cpp_2::model::LlamaModel;
    use llama_cpp_2::params::LlamaContextParams;
    use std::collections::HashMap;
    use tracing::{debug, info};

    pub struct LlamaEngine {
        models: HashMap<String, (LlamaModel, LlamaContext)>,
        current_model_id: String,
    }

    impl LlamaEngine {
        pub fn new(model_paths: &HashMap<String, String>) -> Result<Self> {
            info!("Initializing LlamaEngine with {} models", model_paths.len());

            llama_cpp_2::llama_backend_init();

            let mut models = HashMap::new();
            let mut current_model_id = String::new();

            for (model_id, model_path) in model_paths {
                info!("Loading model '{}' from: {}", model_id, model_path);

                let model = LlamaModel::load_from_file(&llama_cpp_2::LlamaBackend::new()?, model_path)?;

                let mut ctx_params = LlamaContextParams::default();
                ctx_params.n_ctx = 4096;

                let context = LlamaContext::new_with_params(&model, &ctx_params)?;

                models.insert(model_id.clone(), (model, context));

                if current_model_id.is_empty() {
                    current_model_id = model_id.clone();
                }
            }

            if models.is_empty() {
                return Err(anyhow::anyhow!("No models were loaded"));
            }

            info!("Successfully loaded {} models", models.len());

            Ok(Self {
                models,
                current_model_id,
            })
        }

        pub fn generate(&mut self, model_id: &str, prompt: &str, max_tokens: u32, temperature: f32) -> Result<String> {
            info!(
                "Generating text with model '{}' for prompt: '{}' (max: {}, temp: {})",
                model_id, prompt, max_tokens, temperature
            );

            let (model, context) = self
                .models
                .get_mut(model_id)
                .ok_or_else(|| anyhow::anyhow!("Model '{}' not found", model_id))?;

            let tokens_list = model.str_to_token(prompt, true)?;
            context.evaluate(&tokens_list, 0)?;

            let mut result = String::new();
            let mut tokens_generated = 0;

            while tokens_generated < max_tokens {
                let token = if temperature > 0.0 {
                    context.sample_token_with_temperature(temperature)
                } else {
                    context.sample_token_greedy()
                };

                let token_str = model.token_to_str(token)?;
                result.push_str(&token_str);
                context.evaluate(&[token], context.n_tokens())?;

                tokens_generated += 1;

                if token == model.token_eos() {
                    debug!("End-of-sequence token encountered after {} tokens", tokens_generated);
                    break;
                }
            }

            Ok(result)
        }

        pub fn list_models(&self) -> Vec<String> {
            self.models.keys().cloned().collect()
        }

        pub fn set_default_model(&mut self, model_id: &str) -> Result<()> {
            if self.models.contains_key(model_id) {
                self.current_model_id = model_id.to_string();
                Ok(())
            } else {
                Err(anyhow::anyhow!("Model '{}' not found", model_id))
            }
        }

        pub fn get_default_model(&self) -> &str {
            &self.current_model_id
        }
    }
}

#[cfg(not(feature = "native-llama"))]
mod native {
    use anyhow::Result;
    use std::collections::HashMap;

    pub struct LlamaEngine {
        model_ids: Vec<String>,
    }

    impl LlamaEngine {
        pub fn new(model_paths: &HashMap<String, String>) -> Result<Self> {
            Ok(Self {
                model_ids: model_paths.keys().cloned().collect(),
            })
        }

        pub fn generate(&mut self, model_id: &str, _prompt: &str, _max_tokens: u32, _temperature: f32) -> Result<String> {
            Err(anyhow::anyhow!(
                "Native inference disabled (rebuild with --features native-llama) for model '{}'",
                model_id
            ))
        }

        pub fn list_models(&self) -> Vec<String> {
            self.model_ids.clone()
        }

        pub fn set_default_model(&mut self, model_id: &str) -> Result<()> {
            if self.model_ids.iter().any(|id| id == model_id) {
                Ok(())
            } else {
                Err(anyhow::anyhow!("Model '{}' not found", model_id))
            }
        }

        pub fn get_default_model(&self) -> &str {
            self.model_ids.first().map(|s| s.as_str()).unwrap_or("")
        }
    }
}

pub use native::LlamaEngine;

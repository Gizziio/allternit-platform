use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tera::{Context as TeraContext, Tera};

use crate::models::{PromptPack, PromptReceipt, RenderRequest, RenderResult};
use crate::storage::StorageManager;

/// Deterministic prompt renderer using Tera (Jinja2-compatible)
pub struct PromptRenderer {
    storage: std::sync::Arc<StorageManager>,
}

impl PromptRenderer {
    pub fn new(storage: std::sync::Arc<StorageManager>) -> Self {
        Self { storage }
    }

    /// Render a prompt with determinism guarantee
    /// Same inputs (pack_id, version, variables) → Same output
    pub async fn render(&self, request: &RenderRequest, pack: &PromptPack) -> Result<RenderResult> {
        // Get template content
        let prompt_def = pack.prompts.iter()
            .find(|p| p.id == request.prompt_id)
            .context(format!("Prompt '{}' not found in pack '{}'", request.prompt_id, pack.pack_id))?;

        let template_content = self.storage.get_template(
            &pack.pack_id,
            &pack.version,
            &prompt_def.template
        ).await?;

        // Sort variables for determinism
        let sorted_vars = self.sort_variables(&request.variables);

        // Hash inputs for receipt
        let template_hash = hash_string(&template_content);
        let vars_hash = hash_string(&serde_json::to_string(&sorted_vars)?);
        
        // Check cache first (content-addressed)
        let cache_key = format!("{}:{}:{}:{}", pack.pack_id, request.prompt_id, pack.version, vars_hash);
        let content_hash = hash_string(&cache_key);
        
        if let Some(cached) = self.storage.get_cached_rendered(&content_hash).await? {
            let receipt = self.create_receipt(
                &template_hash,
                &vars_hash,
                pack,
                &request.prompt_id,
                &cached,
            );
            
            self.storage.store_receipt(&receipt).await?;

            return Ok(RenderResult {
                rendered: cached,
                content_hash: receipt.content_hash.clone(),
                rendered_hash: receipt.rendered_hash.clone(),
                receipt_id: receipt.receipt_id.clone(),
                pack_id: pack.pack_id.clone(),
                prompt_id: request.prompt_id.clone(),
                version: pack.version.clone(),
                rendered_at: receipt.rendered_at,
                deterministic: pack.deterministic,
            });
        }

        // Build Tera context
        let mut tera = Tera::default();
        
        // Add template
        let template_name = format!("{}/{}/{}", pack.pack_id, pack.version, request.prompt_id);
        tera.add_raw_template(&template_name, &template_content)
            .context("Failed to parse template")?;

        // Load partials if specified
        if let Some(partials) = &prompt_def.partials {
            for partial in partials {
                let partial_content = self.storage.get_template(
                    &pack.pack_id,
                    &pack.version,
                    &format!("partials/{}.j2", partial)
                ).await?;
                
                let partial_name = format!("{}/{}/partials/{}", pack.pack_id, pack.version, partial);
                tera.add_raw_template(&partial_name, &partial_content)
                    .context(format!("Failed to load partial: {}", partial))?;
            }
        }

        // Create context with sorted variables
        let context = TeraContext::from_value(serde_json::to_value(&sorted_vars)?)?;

        // Render
        let rendered = tera.render(&template_name, &context)
            .context("Template rendering failed")?;

        // Apply options
        let final_rendered = if let Some(opts) = &request.options {
            if opts.trim_whitespace == Some(true) {
                rendered.trim().to_string()
            } else {
                rendered
            }
        } else {
            rendered
        };

        // Store in cache
        self.storage.cache_rendered(&content_hash, &final_rendered).await?;

        // Create receipt
        let receipt = self.create_receipt(
            &template_hash,
            &vars_hash,
            pack,
            &request.prompt_id,
            &final_rendered,
        );
        
        self.storage.store_receipt(&receipt).await?;

        Ok(RenderResult {
            rendered: final_rendered,
            content_hash: receipt.content_hash.clone(),
            rendered_hash: receipt.rendered_hash.clone(),
            receipt_id: receipt.receipt_id.clone(),
            pack_id: pack.pack_id.clone(),
            prompt_id: request.prompt_id.clone(),
            version: pack.version.clone(),
            rendered_at: receipt.rendered_at,
            deterministic: pack.deterministic,
        })
    }

    /// Batch render multiple prompts
    pub async fn render_batch(
        &self,
        requests: &[(RenderRequest, PromptPack)],
    ) -> Result<Vec<RenderResult>> {
        let mut results = Vec::with_capacity(requests.len());
        
        for (request, pack) in requests {
            match self.render(request, pack).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    // Return partial results with error
                    return Err(anyhow::anyhow!(
                        "Batch render failed at item {}: {}",
                        results.len(),
                        e
                    ));
                }
            }
        }
        
        Ok(results)
    }

    fn create_receipt(
        &self,
        template_hash: &str,
        vars_hash: &str,
        pack: &PromptPack,
        prompt_id: &str,
        rendered: &str,
    ) -> PromptReceipt {
        let rendered_hash = hash_string(rendered);
        let receipt_id = format!(
            "rpt_{}_{}",
            &template_hash[..16],
            chrono::Utc::now().timestamp_millis()
        );

        PromptReceipt {
            receipt_id,
            pack_id: pack.pack_id.clone(),
            prompt_id: prompt_id.to_string(),
            version: pack.version.clone(),
            content_hash: template_hash.to_string(),
            rendered_hash,
            variables_hash: vars_hash.to_string(),
            rendered_at: chrono::Utc::now(),
            rails_ledger_tx: None,
        }
    }

    /// Sort variables recursively for deterministic hashing
    fn sort_variables(&self, vars: &HashMap<String, serde_json::Value>) -> serde_json::Value {
        let mut sorted: Vec<_> = vars.iter().collect();
        sorted.sort_by(|a, b| a.0.cmp(b.0));
        
        let mut result = serde_json::Map::new();
        for (k, v) in sorted {
            result.insert(k.clone(), self.sort_json_value(v.clone()));
        }
        
        serde_json::Value::Object(result)
    }

    fn sort_json_value(&self, value: serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(map) => {
                let mut sorted: Vec<_> = map.into_iter().collect();
                sorted.sort_by(|a, b| a.0.cmp(&b.0));
                
                let mut result = serde_json::Map::new();
                for (k, v) in sorted {
                    result.insert(k, self.sort_json_value(v));
                }
                serde_json::Value::Object(result)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(
                    arr.into_iter().map(|v| self.sort_json_value(v)).collect()
                )
            }
            other => other,
        }
    }
}

fn hash_string(s: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(s.as_bytes());
    format!("sha256:{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_hash() {
        let input1 = "hello world";
        let input2 = "hello world";
        
        assert_eq!(hash_string(input1), hash_string(input2));
    }

    #[test]
    fn test_different_hashes() {
        let input1 = "hello world";
        let input2 = "hello world!";
        
        assert_ne!(hash_string(input1), hash_string(input2));
    }
}

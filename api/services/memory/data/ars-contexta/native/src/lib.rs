//! Ars Contexta NLP Native Module
//! 
//! Provides high-performance NLP operations using rust-bert:
//! - Named Entity Recognition (NER)
//! - Sentiment Analysis
//! - Embeddings generation
//! - Zero-shot classification
//! 
//! Exposed to Node.js via N-API

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

pub mod entity;
pub mod sentiment;
pub mod embeddings;

/// Module initialization
#[napi]
pub fn init_native_module() -> String {
    format!("Ars Contexta NLP v{}", env!("CARGO_PKG_VERSION"))
}

/// Check which backends are available
#[napi]
pub fn get_available_backends() -> Vec<String> {
    let mut backends = Vec::new();
    
    #[cfg(feature = "rust-bert-backend")]
    backends.push("rust-bert".to_string());
    
    #[cfg(feature = "candle-backend")]
    backends.push("candle".to_string());
    
    if backends.is_empty() {
        backends.push("stub".to_string());
    }
    
    backends
}

/// NER request
#[derive(Debug, Deserialize)]
pub struct NerRequest {
    pub text: String,
    pub model: Option<String>,
    pub min_confidence: Option<f32>,
}

/// NER response
#[derive(Debug, Serialize)]
pub struct NerResponse {
    pub entities: Vec<EntityResult>,
    pub processing_time_ms: u64,
}

/// Entity result
#[derive(Debug, Serialize)]
pub struct EntityResult {
    pub text: String,
    pub label: String,
    pub start: usize,
    pub end: usize,
    pub score: f32,
}

/// Extract entities from text
/// 
/// # Arguments
/// * `request_json` - JSON string containing NerRequest
/// 
/// # Returns
/// JSON string containing NerResponse
#[napi]
pub async fn extract_entities(request_json: String) -> Result<String> {
    let request: NerRequest = serde_json::from_str(&request_json)
        .map_err(|e| Error::from_reason(format!("Invalid request: {}", e)))?;
    
    let start = std::time::Instant::now();
    
    // TODO: Implement actual NER using rust-bert
    // For now, return stub response
    let entities = extract_entities_stub(&request.text);
    
    let response = NerResponse {
        entities,
        processing_time_ms: start.elapsed().as_millis() as u64,
    };
    
    serde_json::to_string(&response)
        .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
}

/// Stub entity extraction (pattern-based)
fn extract_entities_stub(text: &str) -> Vec<EntityResult> {
    let mut entities = Vec::new();
    
    // Simple pattern matching for demonstration
    // In production, this would use rust-bert NER models
    
    // Find capitalized words (potential proper nouns)
    let words: Vec<&str> = text.split_whitespace().collect();
    for (i, word) in words.iter().enumerate() {
        if word.starts_with(char::is_uppercase) && word.len() > 1 {
            let start = text.find(word).unwrap_or(0);
            let end = start + word.len();
            
            // Simple heuristic: check if next word is also capitalized (person/org)
            let label = if i + 1 < words.len() && words[i + 1].starts_with(char::is_uppercase) {
                "PERSON"
            } else {
                "MISC"
            };
            
            entities.push(EntityResult {
                text: word.to_string(),
                label: label.to_string(),
                start,
                end,
                score: 0.75,
            });
        }
    }
    
    entities
}

/// Sentiment request
#[derive(Debug, Deserialize)]
pub struct SentimentRequest {
    pub text: String,
    pub model: Option<String>,
}

/// Sentiment response
#[derive(Debug, Serialize)]
pub struct SentimentResponse {
    pub label: String,
    pub score: f32,
    pub processing_time_ms: u64,
}

/// Analyze sentiment of text
#[napi]
pub async fn analyze_sentiment(request_json: String) -> Result<String> {
    let request: SentimentRequest = serde_json::from_str(&request_json)
        .map_err(|e| Error::from_reason(format!("Invalid request: {}", e)))?;
    
    let start = std::time::Instant::now();
    
    // TODO: Implement actual sentiment analysis using rust-bert
    let (label, score) = analyze_sentiment_stub(&request.text);
    
    let response = SentimentResponse {
        label,
        score,
        processing_time_ms: start.elapsed().as_millis() as u64,
    };
    
    serde_json::to_string(&response)
        .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
}

/// Stub sentiment analysis
fn analyze_sentiment_stub(text: &str) -> (String, f32) {
    let positive_words = ["good", "great", "excellent", "amazing", "best", "love", "awesome"];
    let negative_words = ["bad", "terrible", "worst", "hate", "awful", "poor"];
    
    let lower = text.to_lowercase();
    let mut score = 0.0f32;
    
    for word in &positive_words {
        if lower.contains(word) {
            score += 0.2;
        }
    }
    
    for word in &negative_words {
        if lower.contains(word) {
            score -= 0.2;
        }
    }
    
    score = score.clamp(-1.0, 1.0);
    
    let label = if score > 0.2 {
        "positive"
    } else if score < -0.2 {
        "negative"
    } else {
        "neutral"
    };
    
    (label.to_string(), score)
}

/// Embeddings request
#[derive(Debug, Deserialize)]
pub struct EmbeddingsRequest {
    pub texts: Vec<String>,
    pub model: Option<String>,
}

/// Embeddings response
#[derive(Debug, Serialize)]
pub struct EmbeddingsResponse {
    pub embeddings: Vec<Vec<f32>>,
    pub dimensions: usize,
    pub processing_time_ms: u64,
}

/// Generate embeddings for texts
#[napi]
pub async fn generate_embeddings(request_json: String) -> Result<String> {
    let request: EmbeddingsRequest = serde_json::from_str(&request_json)
        .map_err(|e| Error::from_reason(format!("Invalid request: {}", e)))?;
    
    let start = std::time::Instant::now();
    
    // TODO: Implement actual embeddings using rust-bert
    let embeddings = generate_embeddings_stub(&request.texts);
    let dimensions = embeddings.first().map(|e| e.len()).unwrap_or(384);
    
    let response = EmbeddingsResponse {
        embeddings,
        dimensions,
        processing_time_ms: start.elapsed().as_millis() as u64,
    };
    
    serde_json::to_string(&response)
        .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
}

/// Stub embeddings generation
fn generate_embeddings_stub(texts: &[String]) -> Vec<Vec<f32>> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    texts.iter().map(|text| {
        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let hash = hasher.finish();
        
        // Generate deterministic pseudo-random embeddings
        (0..384).map(|i| {
            let val = ((hash.wrapping_add(i as u64)) % 1000) as f32 / 1000.0;
            val * 2.0 - 1.0  // Normalize to [-1, 1]
        }).collect()
    }).collect()
}

/// Initialize NLP engine with models
#[napi]
pub async fn init_nlp_engine(_models_path: Option<String>) -> Result<bool> {
    // TODO: Load actual models
    // For now, just return success
    Ok(true)
}

/// Get module version
#[napi]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entity_extraction_stub() {
        let text = "Apple Inc. was founded by Steve Jobs.";
        let entities = extract_entities_stub(text);
        assert!(!entities.is_empty());
    }

    #[test]
    fn test_sentiment_stub() {
        let (label, score) = analyze_sentiment_stub("This is great!");
        assert_eq!(label, "positive");
        assert!(score > 0.0);
    }

    #[test]
    fn test_embeddings_stub() {
        let texts = vec!["Hello world".to_string(), "Test text".to_string()];
        let embeddings = generate_embeddings_stub(&texts);
        assert_eq!(embeddings.len(), 2);
        assert_eq!(embeddings[0].len(), 384);
    }
}

//! # A2R Local Inference
//!
//! Local LLM inference engine for the A2R platform.
//!
//! ## Overview
//!
//! This crate provides local language model inference capabilities
//! using the llama.cpp engine. It supports multiple GGUF models
//! and provides both native Rust and Python bridge backends.
//!
//! ## Features
//!
//! - **native-llama**: Enables native llama.cpp inference (requires C++ build)
//! - **python-bridge**: Enables Python-based inference fallback
//!
//! ## Supported Models
//!
//! - Qwen 2.5 (7B parameters)
//! - GLM-4 (9B parameters)
//! - Via Python bridge: LFM-3B, Qwen-Image
//!
//! ## Architecture
//!
//! The crate consists of:
//! - **main.rs**: HTTP API server entry point
//! - **engine_rust.rs**: Native llama.cpp inference engine
//! - **python_bridge.rs**: Python gateway client for remote models
//!
//! ## Example
//!
//! ```rust,no_run
//! use a2rchitech_local_inference::engine_rust::LlamaEngine;
//! use std::collections::HashMap;
//!
//! // Configure model paths
//! let mut model_paths = HashMap::new();
//! model_paths.insert(
//!     "qwen-2.5-7b".to_string(),
//!     "/models/qwen2.5-7b-instruct-q4_k_m.gguf".to_string(),
//! );
//!
//! // Initialize the engine (requires native-llama feature)
//! // let mut engine = LlamaEngine::new(&model_paths)?;
//! // let result = engine.generate("qwen-2.5-7b", "Hello", 512, 0.7)?;
//! ```

pub mod engine_rust;
pub mod python_bridge;

use serde::{Deserialize, Serialize};

/// Inference request payload.
///
/// `InferenceRequest` represents a request to generate text
/// using a local language model.
///
/// # Examples
///
/// ```
/// use a2rchitech_local_inference::InferenceRequest;
///
/// let request = InferenceRequest {
///     model_id: "qwen-2.5-7b".to_string(),
///     prompt: "What is the capital of France?".to_string(),
///     max_tokens: Some(512),
///     temperature: Some(0.7),
/// };
/// ```
#[derive(Debug, Deserialize)]
pub struct InferenceRequest {
    /// Model identifier to use for generation
    pub model_id: String,
    
    /// Input prompt text
    pub prompt: String,
    
    /// Maximum tokens to generate (default: 512)
    pub max_tokens: Option<u32>,
    
    /// Sampling temperature (default: 0.7)
    pub temperature: Option<f32>,
}

impl InferenceRequest {
    /// Returns the effective max tokens (with default).
    pub fn max_tokens_or_default(&self) -> u32 {
        self.max_tokens.unwrap_or(512)
    }
    
    /// Returns the effective temperature (with default).
    pub fn temperature_or_default(&self) -> f32 {
        self.temperature.unwrap_or(0.7)
    }
}

/// Inference response payload.
///
/// `InferenceResponse` contains the generated text and metadata
/// about the inference operation.
///
/// # Examples
///
/// ```
/// use a2rchitech_local_inference::InferenceResponse;
///
/// let response = InferenceResponse {
///     text: "The capital of France is Paris.".to_string(),
///     model_used: "qwen-2.5-7b".to_string(),
///     source: "rust-native".to_string(),
/// };
/// ```
#[derive(Debug, Serialize)]
pub struct InferenceResponse {
    /// Generated text output
    pub text: String,
    
    /// Model that was actually used
    pub model_used: String,
    
    /// Source of the inference (rust-native, python-bridge)
    pub source: String,
}

/// List models response payload.
///
/// `ListModelsResponse` contains the list of available models.
#[derive(Debug, Serialize)]
pub struct ListModelsResponse {
    /// List of available model identifiers
    pub models: Vec<String>,
}

/// Error types for local inference operations.
#[derive(Debug, thiserror::Error)]
pub enum InferenceError {
    /// Model not found
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    
    /// Model loading error
    #[error("Failed to load model: {0}")]
    ModelLoadError(String),
    
    /// Generation error
    #[error("Generation failed: {0}")]
    GenerationError(String),
    
    /// Python bridge error
    #[error("Python bridge error: {0}")]
    PythonBridgeError(String),
    
    /// Invalid parameters
    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),
}

/// Result type for inference operations.
pub type Result<T> = std::result::Result<T, InferenceError>;

/// Default port for the inference service.
pub const DEFAULT_PORT: u16 = 3007;

/// Default host for the inference service.
pub const DEFAULT_HOST: &str = "127.0.0.1";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inference_request_defaults() {
        let req = InferenceRequest {
            model_id: "test".to_string(),
            prompt: "Hello".to_string(),
            max_tokens: None,
            temperature: None,
        };
        
        assert_eq!(req.max_tokens_or_default(), 512);
        assert_eq!(req.temperature_or_default(), 0.7);
        
        let req_with_values = InferenceRequest {
            model_id: "test".to_string(),
            prompt: "Hello".to_string(),
            max_tokens: Some(1024),
            temperature: Some(0.5),
        };
        
        assert_eq!(req_with_values.max_tokens_or_default(), 1024);
        assert_eq!(req_with_values.temperature_or_default(), 0.5);
    }
}

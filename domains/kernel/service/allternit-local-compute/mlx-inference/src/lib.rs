//! # Allternit MLX Inference
//!
//! Apple MLX-based local inference for Allternit.
//!
//! ## Overview
//!
//! This crate provides local language model inference using Apple's
//! MLX framework on Apple Silicon devices. It spawns a Python process
//! for MLX inference and communicates via Unix domain sockets.
//!
//! ## Requirements
//!
//! - Apple Silicon Mac (M1/M2/M3)
//! - Python 3 with MLX installed
//! - Model files in MLX format
//!
//! ## Architecture
//!
//! - **main.rs**: HTTP API server and Python process manager
//! - **inference.py**: Python MLX inference script (external)
//!
//! ## Example
//!
//! ```rust,no_run
//! use allternit_mlx_inference::{InferenceRequest, InferenceResponse};
//!
//! let request = InferenceRequest {
//!     prompt: "Explain quantum computing".to_string(),
//!     max_tokens: Some(256),
//!     temperature: Some(0.7),
//! };
//! ```

use serde::{Deserialize, Serialize};

/// Inference request payload.
#[derive(Debug, Clone, Deserialize)]
pub struct InferenceRequest {
    /// Input prompt for generation
    pub prompt: String,
    
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    
    /// Sampling temperature
    pub temperature: Option<f32>,
}

impl InferenceRequest {
    /// Returns max tokens with default.
    pub fn max_tokens_or_default(&self) -> u32 {
        self.max_tokens.unwrap_or(100)
    }
    
    /// Returns temperature with default.
    pub fn temperature_or_default(&self) -> f32 {
        self.temperature.unwrap_or(0.7)
    }
}

/// Inference response payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    /// Generated text
    pub text: String,
    
    /// Model used for generation
    #[serde(default, alias = "model")]
    pub model_used: String,
    
    /// Status of generation
    pub status: String,
    
    /// Generation time in seconds
    pub generation_time: Option<f64>,
    
    /// Number of input tokens
    pub input_tokens: Option<u32>,
    
    /// Number of output tokens
    pub output_tokens: Option<u32>,
    
    /// Error message if failed
    #[serde(default)]
    pub error: Option<String>,
}

/// Health check response.
#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
    /// Service status
    pub status: String,
    
    /// Service name
    pub service: String,
    
    /// Current timestamp
    pub timestamp: u64,
}

/// Default port for MLX inference service.
pub const DEFAULT_PORT: u16 = 3508;

/// Default socket path for Python communication.
pub const DEFAULT_SOCKET_PATH: &str = "/tmp/mlx-inference.sock";

/// Default model path.
pub const DEFAULT_MODEL_PATH: &str = "/models/mlx/Qwen2-7B-Instruct-4bit";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inference_request_defaults() {
        let req = InferenceRequest {
            prompt: "Hello".to_string(),
            max_tokens: None,
            temperature: None,
        };
        
        assert_eq!(req.max_tokens_or_default(), 100);
        assert_eq!(req.temperature_or_default(), 0.7);
    }
}

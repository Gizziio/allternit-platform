//! # Allternit Local Inference GGUF
//!
//! GGUF-based local inference for Allternit using llama.cpp.
//!
//! ## Overview
//!
//! This crate provides optimized local inference specifically for
//! GGUF (GPT-Generated Unified Format) models. It includes an
//! IPC client for communicating with the inference engine.

use serde::{Deserialize, Serialize};

/// Inference request.
#[derive(Debug, Deserialize)]
pub struct InferenceRequest {
    pub prompt: String,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

/// Inference response.
#[derive(Debug, Serialize)]
pub struct InferenceResponse {
    pub success: bool,
    pub response: String,
    pub model: String,
    pub tokens_used: Option<u32>,
}

/// Default port for the GGUF inference service.
pub const DEFAULT_PORT: u16 = 3010;

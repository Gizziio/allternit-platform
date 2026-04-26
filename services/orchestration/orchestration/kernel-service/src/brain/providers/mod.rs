//! Provider management module
//!
//! Thin wiring that re-exports from allternit-providers (1-kernel).
//! All business logic lives in 1-kernel/infrastructure/allternit-providers.

pub use allternit_providers::runtime::{
    // Auth exports
    AuthStatus, ModelsResponse, ProviderAuthConfig, ProviderAuthRegistry, RuntimeModel,
    StatusCheckMode, ValidateModelRequest, ValidateModelResponse,
    // Model exports
    ModelAdapterRegistry, ModelDiscoveryResponse, ProviderModel, ProviderModelAdapter,
    ValidateModelRequest as ModelsValidateRequest, ValidateModelResponse as ModelsValidateResponse,
    profile_to_provider_id, provider_to_profile_id,
    // Model adapter exports
    ClaudeModelAdapter, CodexModelAdapter, DeepSeekModelAdapter, GeminiModelAdapter,
    GroqModelAdapter, KimiModelAdapter, LmStudioModelAdapter, MistralModelAdapter,
    OllamaModelAdapter, OpenCodeModelAdapter, OpenRouterModelAdapter,
};

//! Provider Runtime Module
//!
//! Handles runtime provider operations:
//! - Authentication status checking
//! - Auth wizard configuration
//! - Model discovery and validation
//! - Provider-to-profile mapping
//! - Normalized types and error handling

pub mod adapter;
pub mod adapters;
pub mod auth;
pub mod errors;
pub mod models;
pub mod normalized;
pub mod usage;

pub use adapter::{AuthMethodType, ProviderAdapter, ProviderAdapterRegistry, ProviderMetadata};

pub use auth::{
    AuthStatus, ModelsResponse, ProviderAuthConfig, ProviderAuthRegistry, RuntimeModel,
    StatusCheckMode, ValidateModelRequest, ValidateModelResponse,
};

pub use errors::{
    extract_retry_after, map_http_status, ErrorMapper, ProviderError, ProviderErrorKind,
};

pub use models::{
    profile_to_provider_id,
    provider_to_profile_id,
    // Re-export all adapter structs
    ClaudeModelAdapter,
    CodexModelAdapter,
    CohereModelAdapter,
    DeepSeekModelAdapter,
    FireworksModelAdapter,
    GeminiModelAdapter,
    GroqModelAdapter,
    KimiModelAdapter,
    LmStudioModelAdapter,
    MistralModelAdapter,
    ModelAdapterRegistry,
    ModelDiscoveryResponse,
    OllamaModelAdapter,
    OpenAiModelAdapter,
    OpenCodeModelAdapter,
    OpenRouterModelAdapter,
    PerplexityModelAdapter,
    ProviderModel,
    ProviderModelAdapter,
    TogetherModelAdapter,
    ValidateModelRequest as ModelsValidateRequest,
    ValidateModelResponse as ModelsValidateResponse,
};

pub use normalized::{
    FinishReason, ModelMeta, NormalizedDelta, NormalizedModelInfo, NormalizedModelsResponse,
    NormalizedResponse, NormalizedToolCall, NormalizedToolResult, NormalizedValidateResponse,
    Normalizer,
};

pub use usage::{NormalizedUsage, UsageAggregator};

pub use adapters::{
    ClaudeAdapter, CodexAdapter, CohereAdapter, DeepSeekAdapter, FireworksAdapter, GeminiAdapter,
    GroqAdapter, KimiAdapter, LmStudioAdapter, MistralAdapter, OllamaAdapter, OpenAiAdapter,
    OpenCodeAdapter, OpenRouterAdapter, PerplexityAdapter, TogetherAdapter,
};

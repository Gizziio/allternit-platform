# Action Plan: Phase 8 Multi-Provider LLM System

## Goal
Transform the Allternit Kernel into a multi-provider AI powerhouse. Move beyond "Local Only" to support industry-standard providers (OpenAI, Anthropic, Gemini, OpenRouter) with proper authentication management via the CLI.

## Architectural Changes

### 1. Kernel (The Brain/Daemon)
*   **Refactor `LLMGateway`**:
    *   Rename `OpenAIAdapter` to `GenericProvider`.
    *   Introduce `ProviderTrait` for standardized `complete` and `embed` calls.
    *   Implement specific adapters: `AnthropicProvider`, `GeminiProvider`.
    *   Create `ProviderManager` to hold the registry of configured providers and handle routing.
*   **Configuration Persistence**:
    *   Store API keys and model preferences in `workspace/config/llm_config.json` (encrypted/obfuscated in future, plain for now for portability).
*   **API Extensions**:
    *   `POST /v1/config/auth/:provider`: endpoint to set keys.
    *   `GET /v1/config/models`: list available/configured models.

### 2. CLI (The Agent/Interface)
*   **Location**: `apps/cli`
*   **New Commands**:
    *   `a2 auth login <provider>`: Interactive flow to set API keys.
    *   `a2 model list`: Show all available models from configured providers.
    *   `a2 model use <model_id>`: Set the default model for the kernel.
    *   `a2 run "<prompt>"`: Quick interaction with the active brain.

## Implementation Steps

1.  **Kernel: Provider Architecture**
    *   Modify `services/kernel/src/llm/gateway.rs` to define the `LLMProvider` trait.
    *   Implement `AnthropicAdapter` and `GeminiAdapter`.
    *   Update `LLMGateway` to manage multiple providers.

2.  **Kernel: Configuration API**
    *   Create `services/kernel/src/config_manager.rs`.
    *   Expose endpoints in `main.rs` for the CLI to talk to.

3.  **CLI: Command Implementation**
    *   Update `apps/cli/src/main.rs` (or create if empty) to use `clap` for subcommands.
    *   Implement the HTTP client in CLI to talk to Kernel APIs.

## Supported Providers
*   **OpenAI**: Standard API.
*   **Anthropic**: Claude API (different headers/format).
*   **Gemini**: Google AI API.
*   **OpenRouter**: OpenAI-compatible but needs specific base URL handling.
*   **Local**: OpenAI-compatible (Ollama/vLLM) with custom base URLs.

## Affected Files
*   `services/kernel/src/llm/*`
*   `services/kernel/src/main.rs`
*   `apps/cli/src/main.rs`
*   `apps/cli/Cargo.toml`

## Verification
*   `cargo run -p kernel`
*   `a2 auth login openai` -> Sets key.
*   `a2 run "Hello"` -> Routes to OpenAI.

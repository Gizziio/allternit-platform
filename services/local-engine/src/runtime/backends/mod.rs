//! Backend-specific runtime launch logic.

pub mod llamacpp;

pub use llamacpp::{LlamaCppConfig, build_argv, chat_completions_url, health_url};

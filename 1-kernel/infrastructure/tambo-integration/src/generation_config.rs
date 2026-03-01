//! Generation Configuration for Tambo UI Generation
//!
//! Provides configuration options for controlling UI generation behavior:
//! - Seed-based reproducibility
//! - Temperature control
//! - Validation settings
//! - Streaming configuration

use serde::{Deserialize, Serialize};

/// Generation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationConfig {
    /// Random seed for reproducibility (None = random)
    pub seed: Option<u64>,

    /// Temperature for generation (0.0 = deterministic, 1.0 = creative)
    pub temperature: f32,

    /// Enable schema validation
    pub validate: bool,

    /// Maximum retries for streaming
    pub max_retries: u32,

    /// Retry delay in milliseconds
    pub retry_delay_ms: u64,

    /// Generation mode
    pub mode: GenerationMode,
}

/// Generation mode
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GenerationMode {
    /// Standard generation (fast, no validation)
    Standard,

    /// Validated generation (schema validation enabled)
    Validated,

    /// Reproducible generation (seed-based)
    Reproducible,

    /// Streaming generation (chunked output)
    Streaming,
}

impl Default for GenerationConfig {
    fn default() -> Self {
        Self {
            seed: None,
            temperature: 0.7,
            validate: false,
            max_retries: 3,
            retry_delay_ms: 1000,
            mode: GenerationMode::Standard,
        }
    }
}

impl GenerationConfig {
    /// Create a new config with standard settings
    pub fn standard() -> Self {
        Self {
            mode: GenerationMode::Standard,
            ..Default::default()
        }
    }

    /// Create a new config with validation enabled
    pub fn validated() -> Self {
        Self {
            mode: GenerationMode::Validated,
            validate: true,
            ..Default::default()
        }
    }

    /// Create a new config with reproducibility enabled
    pub fn reproducible(seed: u64) -> Self {
        Self {
            mode: GenerationMode::Reproducible,
            seed: Some(seed),
            temperature: 0.0, // Fully deterministic
            validate: true,
            ..Default::default()
        }
    }

    /// Create a new config for streaming
    pub fn streaming() -> Self {
        Self {
            mode: GenerationMode::Streaming,
            max_retries: 5,
            retry_delay_ms: 500,
            ..Default::default()
        }
    }

    /// Set the seed for reproducibility
    pub fn with_seed(mut self, seed: u64) -> Self {
        self.seed = Some(seed);
        self.mode = GenerationMode::Reproducible;
        self.temperature = 0.0;
        self
    }

    /// Set the temperature
    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = temperature.clamp(0.0, 1.0);
        self
    }

    /// Enable validation
    pub fn with_validation(mut self, validate: bool) -> Self {
        self.validate = validate;
        if validate {
            self.mode = GenerationMode::Validated;
        }
        self
    }

    /// Set max retries
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Check if generation should be deterministic
    pub fn is_deterministic(&self) -> bool {
        self.temperature == 0.0 || self.seed.is_some()
    }

    /// Check if validation is enabled
    pub fn should_validate(&self) -> bool {
        self.validate || self.mode == GenerationMode::Validated
    }

    /// Check if streaming is enabled
    pub fn is_streaming(&self) -> bool {
        self.mode == GenerationMode::Streaming
    }
}

/// Streaming configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamConfig {
    /// Maximum retries on error
    pub max_retries: u32,

    /// Delay between retries in milliseconds
    pub retry_delay_ms: u64,

    /// Chunk size for streaming
    pub chunk_size: usize,

    /// Enable progress events
    pub emit_progress: bool,
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            retry_delay_ms: 1000,
            chunk_size: 100,
            emit_progress: true,
        }
    }
}

impl StreamConfig {
    /// Create a new stream config
    pub fn new() -> Self {
        Self::default()
    }

    /// Set max retries
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set retry delay
    pub fn with_retry_delay(mut self, delay_ms: u64) -> Self {
        self.retry_delay_ms = delay_ms;
        self
    }

    /// Set chunk size
    pub fn with_chunk_size(mut self, chunk_size: usize) -> Self {
        self.chunk_size = chunk_size;
        self
    }

    /// Enable/disable progress events
    pub fn with_progress(mut self, emit: bool) -> Self {
        self.emit_progress = emit;
        self
    }
}

/// Reproducibility configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReproducibilityConfig {
    /// Seed for random number generation
    pub seed: u64,

    /// Hash algorithm for verification
    pub hash_algorithm: String,

    /// Store generation hash for verification
    pub store_hash: bool,
}

impl Default for ReproducibilityConfig {
    fn default() -> Self {
        Self {
            seed: 0,
            hash_algorithm: "sha256".to_string(),
            store_hash: true,
        }
    }
}

impl ReproducibilityConfig {
    /// Create a new reproducibility config with given seed
    pub fn with_seed(seed: u64) -> Self {
        Self {
            seed,
            ..Default::default()
        }
    }

    /// Set hash algorithm
    pub fn with_hash_algorithm(mut self, algorithm: &str) -> Self {
        self.hash_algorithm = algorithm.to_string();
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = GenerationConfig::default();
        assert_eq!(config.temperature, 0.7);
        assert!(!config.validate);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.mode, GenerationMode::Standard);
    }

    #[test]
    fn test_validated_config() {
        let config = GenerationConfig::validated();
        assert!(config.validate);
        assert_eq!(config.mode, GenerationMode::Validated);
        assert!(config.should_validate());
    }

    #[test]
    fn test_reproducible_config() {
        let config = GenerationConfig::reproducible(42);
        assert_eq!(config.seed, Some(42));
        assert_eq!(config.temperature, 0.0);
        assert!(config.is_deterministic());
        assert_eq!(config.mode, GenerationMode::Reproducible);
    }

    #[test]
    fn test_streaming_config() {
        let config = GenerationConfig::streaming();
        assert_eq!(config.mode, GenerationMode::Streaming);
        assert!(config.is_streaming());
        assert_eq!(config.max_retries, 5);
    }

    #[test]
    fn test_builder_pattern() {
        let config = GenerationConfig::standard()
            .with_seed(123)
            .with_temperature(0.5)
            .with_validation(true)
            .with_max_retries(10);

        assert_eq!(config.seed, Some(123));
        assert_eq!(config.temperature, 0.5);
        assert!(config.validate);
        assert_eq!(config.max_retries, 10);
    }

    #[test]
    fn test_deterministic_check() {
        let config1 = GenerationConfig::default();
        assert!(!config1.is_deterministic());

        let config2 = GenerationConfig::reproducible(42);
        assert!(config2.is_deterministic());

        let config3 = GenerationConfig::standard().with_temperature(0.0);
        assert!(config3.is_deterministic());
    }

    #[test]
    fn test_stream_config() {
        let config = StreamConfig::new()
            .with_max_retries(5)
            .with_retry_delay(2000)
            .with_chunk_size(200)
            .with_progress(false);

        assert_eq!(config.max_retries, 5);
        assert_eq!(config.retry_delay_ms, 2000);
        assert_eq!(config.chunk_size, 200);
        assert!(!config.emit_progress);
    }

    #[test]
    fn test_reproducibility_config() {
        let config = ReproducibilityConfig::with_seed(999).with_hash_algorithm("md5");

        assert_eq!(config.seed, 999);
        assert_eq!(config.hash_algorithm, "md5");
        assert!(config.store_hash);
    }

    #[test]
    fn test_serialization() {
        let config = GenerationConfig::reproducible(42);
        let json = serde_json::to_string(&config).unwrap();

        let deserialized: GenerationConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.seed, config.seed);
        assert_eq!(deserialized.mode, config.mode);
    }
}

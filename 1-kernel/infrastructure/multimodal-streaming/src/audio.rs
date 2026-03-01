//! Audio Stream Processing
//!
//! Processes audio streams for agents.

use crate::{MultimodalError, StreamMetadata};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Processed audio chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioChunk {
    pub chunk_id: String,
    pub timestamp: DateTime<Utc>,
    pub sample_rate: u32,
    pub channels: u16,
    pub format: String,
    pub data: Vec<u8>,
    pub duration_ms: u64,
}

/// Audio features extracted from chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFeatures {
    pub rms_energy: f32,
    pub zero_crossing_rate: f32,
    pub dominant_frequency: Option<f32>,
    pub speech_probability: f32,
}

/// Audio processor
pub struct AudioProcessor {
    chunk_count: Arc<RwLock<u64>>,
    processing_enabled: Arc<RwLock<bool>>,
    sample_rate: Arc<RwLock<u32>>,
}

impl AudioProcessor {
    /// Create a new audio processor
    pub fn new() -> Self {
        Self {
            chunk_count: Arc::new(RwLock::new(0)),
            processing_enabled: Arc::new(RwLock::new(true)),
            sample_rate: Arc::new(RwLock::new(44100)),
        }
    }

    /// Process an audio chunk
    pub async fn process_chunk(
        &self,
        audio_data: &[u8],
        metadata: StreamMetadata,
    ) -> Result<AudioChunk, MultimodalError> {
        let enabled = *self.processing_enabled.read().await;
        if !enabled {
            return Err(MultimodalError::InvalidFrameFormat(
                "Audio processing disabled".to_string(),
            ));
        }

        // Validate audio data
        if audio_data.is_empty() {
            return Err(MultimodalError::InvalidFrameFormat(
                "Empty audio data".to_string(),
            ));
        }

        // Extract metadata
        let sample_rate = metadata.sample_rate.unwrap_or(44100);
        let channels = metadata.channels.unwrap_or(2);
        let format = metadata.format.unwrap_or_else(|| "pcm".to_string());
        let duration_ms = metadata.duration_ms.unwrap_or(20);

        // Increment chunk count
        {
            let mut count = self.chunk_count.write().await;
            *count += 1;
        }

        // In production, this would:
        // 1. Decode the audio
        // 2. Extract features (MFCC, spectrogram, etc.)
        // 3. Run speech recognition
        // 4. Detect speaker, emotion, etc.

        Ok(AudioChunk {
            chunk_id: format!("audio_{}", Utc::now().timestamp_nanos()),
            timestamp: Utc::now(),
            sample_rate,
            channels,
            format,
            data: audio_data.to_vec(),
            duration_ms,
        })
    }

    /// Get current chunk count
    pub async fn get_chunk_count(&self) -> u64 {
        *self.chunk_count.read().await
    }

    /// Enable/disable processing
    pub async fn set_processing_enabled(&self, enabled: bool) {
        let mut processing = self.processing_enabled.write().await;
        *processing = enabled;
    }

    /// Set sample rate
    pub async fn set_sample_rate(&self, sample_rate: u32) {
        let mut rate = self.sample_rate.write().await;
        *rate = sample_rate;
    }

    /// Get current sample rate
    pub async fn get_sample_rate(&self) -> u32 {
        *self.sample_rate.read().await
    }

    /// Reset chunk count
    pub async fn reset_chunk_count(&self) {
        let mut count = self.chunk_count.write().await;
        *count = 0;
    }

    /// Extract audio features from chunk
    pub async fn extract_features(
        &self,
        chunk: &AudioChunk,
    ) -> Result<AudioFeatures, MultimodalError> {
        // In production, this would calculate actual audio features
        // For now, return placeholder values

        Ok(AudioFeatures {
            rms_energy: 0.5,
            zero_crossing_rate: 0.1,
            dominant_frequency: Some(440.0),
            speech_probability: 0.8,
        })
    }
}

impl Default for AudioProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_audio_processor_creation() {
        let processor = AudioProcessor::new();
        let count = processor.get_chunk_count().await;
        assert_eq!(count, 0);

        let sample_rate = processor.get_sample_rate().await;
        assert_eq!(sample_rate, 44100);
    }

    #[tokio::test]
    async fn test_chunk_processing() {
        let processor = AudioProcessor::new();

        let audio_data = vec![0u8; 1024];
        let metadata = StreamMetadata {
            sample_rate: Some(48000),
            channels: Some(1),
            format: Some("pcm".to_string()),
            duration_ms: Some(50),
            ..Default::default()
        };

        let result = processor.process_chunk(&audio_data, metadata).await;
        assert!(result.is_ok());

        let chunk = result.unwrap();
        assert_eq!(chunk.sample_rate, 48000);
        assert_eq!(chunk.channels, 1);
        assert_eq!(chunk.format, "pcm");
        assert_eq!(chunk.duration_ms, 50);
    }

    #[tokio::test]
    async fn test_empty_audio_rejected() {
        let processor = AudioProcessor::new();

        let metadata = StreamMetadata::default();
        let result = processor.process_chunk(&[], metadata).await;

        assert!(result.is_err());
        assert!(matches!(
            result,
            Err(MultimodalError::InvalidFrameFormat(_))
        ));
    }

    #[tokio::test]
    async fn test_chunk_count_increment() {
        let processor = AudioProcessor::new();

        let audio_data = vec![0u8; 512];
        let metadata = StreamMetadata::default();

        processor
            .process_chunk(&audio_data, metadata.clone())
            .await
            .unwrap();
        processor
            .process_chunk(&audio_data, metadata.clone())
            .await
            .unwrap();
        processor
            .process_chunk(&audio_data, metadata)
            .await
            .unwrap();

        let count = processor.get_chunk_count().await;
        assert_eq!(count, 3);
    }

    #[tokio::test]
    async fn test_processing_toggle() {
        let processor = AudioProcessor::new();

        processor.set_processing_enabled(false).await;

        let audio_data = vec![0u8; 512];
        let metadata = StreamMetadata::default();

        let result = processor.process_chunk(&audio_data, metadata.clone()).await;
        assert!(result.is_err());

        processor.set_processing_enabled(true).await;

        let result = processor.process_chunk(&audio_data, metadata).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_sample_rate_change() {
        let processor = AudioProcessor::new();

        let initial_rate = processor.get_sample_rate().await;
        assert_eq!(initial_rate, 44100);

        processor.set_sample_rate(48000).await;

        let new_rate = processor.get_sample_rate().await;
        assert_eq!(new_rate, 48000);
    }

    #[tokio::test]
    async fn test_feature_extraction() {
        let processor = AudioProcessor::new();

        let chunk = AudioChunk {
            chunk_id: "test_chunk".to_string(),
            timestamp: Utc::now(),
            sample_rate: 44100,
            channels: 2,
            format: "pcm".to_string(),
            data: vec![0u8; 1024],
            duration_ms: 20,
        };

        let features = processor.extract_features(&chunk).await;
        assert!(features.is_ok());

        let features = features.unwrap();
        assert!(features.speech_probability >= 0.0);
        assert!(features.speech_probability <= 1.0);
    }

    #[test]
    fn test_audio_chunk_serialization() {
        let chunk = AudioChunk {
            chunk_id: "chunk_test".to_string(),
            timestamp: Utc::now(),
            sample_rate: 44100,
            channels: 2,
            format: "pcm".to_string(),
            data: vec![0, 1, 2, 3],
            duration_ms: 20,
        };

        let serialized = serde_json::to_string(&chunk).unwrap();
        assert!(serialized.contains("chunk_test"));
        assert!(serialized.contains("44100"));
    }

    #[test]
    fn test_audio_features_creation() {
        let features = AudioFeatures {
            rms_energy: 0.75,
            zero_crossing_rate: 0.15,
            dominant_frequency: Some(880.0),
            speech_probability: 0.92,
        };

        assert_eq!(features.rms_energy, 0.75);
        assert_eq!(features.dominant_frequency, Some(880.0));
        assert_eq!(features.speech_probability, 0.92);
    }
}

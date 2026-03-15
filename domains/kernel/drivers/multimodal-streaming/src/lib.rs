//! Multimodal Streaming
//!
//! Implements vision and audio streaming for agents:
//! - Vision stream processing
//! - Audio stream processing
//! - Synchronized multimodal input
//! - Stream transcription
//!
//! See: P4.9 DAG Task Specification

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::{broadcast, mpsc, RwLock};

pub mod audio;
pub mod synchronizer;
pub mod vision;

pub use audio::*;
pub use synchronizer::*;
pub use vision::*;

/// Active stream info for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveStreamInfo {
    pub stream_id: String,
    pub stream_type: String,
    pub client_id: String,
    pub started_at: DateTime<Utc>,
    pub status: String,
}

/// Multimodal stream types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StreamType {
    Vision,
    Audio,
    Multimodal,
}

/// Stream frame data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamFrame {
    pub frame_id: String,
    pub stream_id: String,
    pub stream_type: StreamType,
    pub timestamp: DateTime<Utc>,
    pub data: Vec<u8>,
    pub metadata: StreamMetadata,
}

/// Stream metadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StreamMetadata {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub format: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    pub duration_ms: Option<u64>,
}

/// Stream configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamConfig {
    pub stream_id: String,
    pub stream_type: StreamType,
    pub buffer_size: usize,
    pub max_latency_ms: u64,
}

/// Multimodal streaming engine
pub struct MultimodalEngine {
    vision_processor: VisionProcessor,
    audio_processor: AudioProcessor,
    synchronizer: StreamSynchronizer,
    streams: Arc<RwLock<Vec<StreamConfig>>>,
}

impl MultimodalEngine {
    /// Create a new multimodal engine
    pub fn new() -> Self {
        Self {
            vision_processor: VisionProcessor::new(),
            audio_processor: AudioProcessor::new(),
            synchronizer: StreamSynchronizer::new(),
            streams: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register a new stream
    pub async fn register_stream(&self, config: StreamConfig) {
        let mut streams = self.streams.write().await;
        streams.push(config);
    }

    /// Process a vision frame
    pub async fn process_vision_frame(
        &self,
        frame_data: &[u8],
        metadata: StreamMetadata,
    ) -> Result<VisionFrame, MultimodalError> {
        self.vision_processor
            .process_frame(frame_data, metadata)
            .await
    }

    /// Process an audio chunk
    pub async fn process_audio_chunk(
        &self,
        audio_data: &[u8],
        metadata: StreamMetadata,
    ) -> Result<AudioChunk, MultimodalError> {
        self.audio_processor
            .process_chunk(audio_data, metadata)
            .await
    }

    /// Synchronize vision and audio streams
    pub async fn synchronize(
        &self,
        vision_frames: Vec<VisionFrame>,
        audio_chunks: Vec<AudioChunk>,
    ) -> Vec<SynchronizedFrame> {
        self.synchronizer
            .synchronize(vision_frames, audio_chunks)
            .await
    }

    /// Get registered streams
    pub async fn get_streams(&self) -> Vec<StreamConfig> {
        self.streams.read().await.clone()
    }

    /// Start streaming from a source
    pub async fn start_stream(
        &self,
        stream_id: &str,
    ) -> Result<(mpsc::Sender<StreamFrame>, broadcast::Receiver<StreamFrame>), MultimodalError>
    {
        let (tx, rx) = mpsc::channel(100);
        let (broadcast_tx, broadcast_rx) = broadcast::channel(1000);

        // Store broadcast sender for distribution
        // In production, this would be stored in a map

        Ok((tx, broadcast_rx))
    }

    /// Get active streams with status
    pub async fn get_active_streams(&self) -> Vec<ActiveStreamInfo> {
        let streams = self.streams.read().await;
        streams
            .iter()
            .map(|s| ActiveStreamInfo {
                stream_id: s.stream_id.clone(),
                stream_type: format!("{:?}", s.stream_type),
                client_id: "unknown".to_string(),
                started_at: Utc::now(),
                status: "active".to_string(),
            })
            .collect()
    }

    /// Get specific stream
    pub async fn get_stream(&self, stream_id: &str) -> Option<StreamConfig> {
        let streams = self.streams.read().await;
        streams.iter().find(|s| s.stream_id == stream_id).cloned()
    }

    /// Stop a stream
    pub async fn stop_stream(&self, stream_id: &str) -> bool {
        let mut streams = self.streams.write().await;
        let initial_len = streams.len();
        streams.retain(|s| s.stream_id != stream_id);
        streams.len() < initial_len
    }
}

impl Default for MultimodalEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Multimodal errors
#[derive(Debug, Error)]
pub enum MultimodalError {
    #[error("Stream not found: {0}")]
    StreamNotFound(String),

    #[error("Invalid frame format: {0}")]
    InvalidFrameFormat(String),

    #[error("Synchronization failed: {0}")]
    SyncFailed(String),

    #[error("Buffer overflow")]
    BufferOverflow,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_multimodal_engine_creation() {
        let engine = MultimodalEngine::new();
        let streams = engine.get_streams().await;
        assert!(streams.is_empty());
    }

    #[tokio::test]
    async fn test_stream_registration() {
        let engine = MultimodalEngine::new();

        let config = StreamConfig {
            stream_id: "vision_1".to_string(),
            stream_type: StreamType::Vision,
            buffer_size: 100,
            max_latency_ms: 50,
        };

        engine.register_stream(config).await;

        let streams = engine.get_streams().await;
        assert_eq!(streams.len(), 1);
        assert_eq!(streams[0].stream_id, "vision_1");
    }

    #[test]
    fn test_stream_type_serialization() {
        let types = vec![
            StreamType::Vision,
            StreamType::Audio,
            StreamType::Multimodal,
        ];

        for stream_type in types {
            let serialized = serde_json::to_string(&stream_type).unwrap();
            assert!(!serialized.is_empty());
        }
    }

    #[test]
    fn test_stream_frame_creation() {
        let frame = StreamFrame {
            frame_id: "frame_1".to_string(),
            stream_id: "stream_1".to_string(),
            stream_type: StreamType::Vision,
            timestamp: Utc::now(),
            data: vec![0, 1, 2, 3],
            metadata: StreamMetadata {
                width: Some(1920),
                height: Some(1080),
                format: Some("rgb".to_string()),
                sample_rate: None,
                channels: None,
                duration_ms: None,
            },
        };

        assert_eq!(frame.frame_id, "frame_1");
        assert_eq!(frame.stream_type, StreamType::Vision);
        assert_eq!(frame.metadata.width, Some(1920));
    }

    #[test]
    fn test_stream_metadata_creation() {
        let metadata = StreamMetadata {
            width: Some(1280),
            height: Some(720),
            format: Some("yuv".to_string()),
            sample_rate: Some(44100),
            channels: Some(2),
            duration_ms: Some(1000),
        };

        assert_eq!(metadata.width, Some(1280));
        assert_eq!(metadata.height, Some(720));
        assert_eq!(metadata.sample_rate, Some(44100));
        assert_eq!(metadata.channels, Some(2));
    }

    #[test]
    fn test_stream_config_creation() {
        let config = StreamConfig {
            stream_id: "config_test".to_string(),
            stream_type: StreamType::Audio,
            buffer_size: 200,
            max_latency_ms: 100,
        };

        assert_eq!(config.stream_id, "config_test");
        assert_eq!(config.stream_type, StreamType::Audio);
        assert_eq!(config.buffer_size, 200);
    }

    #[tokio::test]
    async fn test_vision_frame_processing() {
        let engine = MultimodalEngine::new();

        // Create minimal valid image data (1x1 pixel PNG)
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49,
            0x44, 0x41, // IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC,
            0xCC, 0x59, 0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82,
        ];

        let metadata = StreamMetadata {
            width: Some(1),
            height: Some(1),
            format: Some("png".to_string()),
            ..Default::default()
        };

        let result = engine.process_vision_frame(&png_data, metadata).await;
        // Should succeed with valid PNG
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_audio_chunk_processing() {
        let engine = MultimodalEngine::new();

        let audio_data = vec![0u8; 1024]; // 1024 bytes of audio
        let metadata = StreamMetadata {
            sample_rate: Some(44100),
            channels: Some(2),
            format: Some("pcm".to_string()),
            ..Default::default()
        };

        let result = engine.process_audio_chunk(&audio_data, metadata).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_stream_synchronization() {
        let engine = MultimodalEngine::new();

        let vision_frames = vec![VisionFrame {
            frame_id: "v1".to_string(),
            timestamp: Utc::now(),
            width: 640,
            height: 480,
            format: "rgb".to_string(),
            data: vec![],
            features: vec![],
        }];

        let audio_chunks = vec![AudioChunk {
            chunk_id: "a1".to_string(),
            timestamp: Utc::now(),
            sample_rate: 44100,
            channels: 2,
            format: "pcm".to_string(),
            data: vec![],
            duration_ms: 20,
        }];

        let synchronized = engine.synchronize(vision_frames, audio_chunks).await;
        // Should produce synchronized frames
        assert!(!synchronized.is_empty());
    }
}

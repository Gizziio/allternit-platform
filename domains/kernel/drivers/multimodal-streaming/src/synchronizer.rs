//! Stream Synchronizer
//!
//! Synchronizes vision and audio streams for multimodal processing.

use crate::{AudioChunk, VisionFrame};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Synchronized frame containing both vision and audio
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SynchronizedFrame {
    pub sync_id: String,
    pub timestamp: DateTime<Utc>,
    pub vision_frame: Option<VisionFrame>,
    pub audio_chunk: Option<AudioChunk>,
    pub sync_offset_ms: i64,
}

/// Stream synchronizer for aligning vision and audio
pub struct StreamSynchronizer {
    vision_buffer: Arc<RwLock<VecDeque<VisionFrame>>>,
    audio_buffer: Arc<RwLock<VecDeque<AudioChunk>>>,
    max_buffer_size: usize,
    sync_tolerance_ms: i64,
}

impl StreamSynchronizer {
    /// Create a new stream synchronizer
    pub fn new() -> Self {
        Self {
            vision_buffer: Arc::new(RwLock::new(VecDeque::new())),
            audio_buffer: Arc::new(RwLock::new(VecDeque::new())),
            max_buffer_size: 100,
            sync_tolerance_ms: 50, // 50ms tolerance for synchronization
        }
    }

    /// Add a vision frame to the buffer
    pub async fn add_vision_frame(&self, frame: VisionFrame) {
        let mut buffer = self.vision_buffer.write().await;

        if buffer.len() >= self.max_buffer_size {
            buffer.pop_front();
        }

        buffer.push_back(frame);
    }

    /// Add an audio chunk to the buffer
    pub async fn add_audio_chunk(&self, chunk: AudioChunk) {
        let mut buffer = self.audio_buffer.write().await;

        if buffer.len() >= self.max_buffer_size {
            buffer.pop_front();
        }

        buffer.push_back(chunk);
    }

    /// Synchronize vision frames with audio chunks
    pub async fn synchronize(
        &self,
        vision_frames: Vec<VisionFrame>,
        audio_chunks: Vec<AudioChunk>,
    ) -> Vec<SynchronizedFrame> {
        let mut synchronized = Vec::new();

        // Simple synchronization: pair by index
        // In production, would use timestamps for precise alignment
        let max_len = vision_frames.len().max(audio_chunks.len());

        for i in 0..max_len {
            let vision = vision_frames.get(i).cloned();
            let audio = audio_chunks.get(i).cloned();

            let timestamp = vision
                .as_ref()
                .map(|v| v.timestamp)
                .or_else(|| audio.as_ref().map(|a| a.timestamp))
                .unwrap_or_else(Utc::now);

            // Calculate sync offset
            let sync_offset_ms = match (&vision, &audio) {
                (Some(v), Some(a)) => {
                    let v_ts = v.timestamp.timestamp_millis();
                    let a_ts = a.timestamp.timestamp_millis();
                    v_ts - a_ts
                }
                _ => 0,
            };

            synchronized.push(SynchronizedFrame {
                sync_id: format!("sync_{}_{}", timestamp.timestamp(), i),
                timestamp,
                vision_frame: vision,
                audio_chunk: audio,
                sync_offset_ms,
            });
        }

        synchronized
    }

    /// Get synchronized frames from buffers
    pub async fn get_synchronized(&self) -> Vec<SynchronizedFrame> {
        let vision_buffer = self.vision_buffer.read().await;
        let audio_buffer = self.audio_buffer.read().await;

        let vision_frames: Vec<VisionFrame> = vision_buffer.iter().cloned().collect();
        let audio_chunks: Vec<AudioChunk> = audio_buffer.iter().cloned().collect();

        self.synchronize(vision_frames, audio_chunks).await
    }

    /// Clear all buffers
    pub async fn clear_buffers(&self) {
        let mut vision = self.vision_buffer.write().await;
        vision.clear();

        let mut audio = self.audio_buffer.write().await;
        audio.clear();
    }

    /// Get buffer sizes
    pub async fn get_buffer_sizes(&self) -> (usize, usize) {
        let vision = self.vision_buffer.read().await;
        let audio = self.audio_buffer.read().await;
        (vision.len(), audio.len())
    }

    /// Set sync tolerance
    pub fn set_sync_tolerance_ms(&mut self, tolerance_ms: i64) {
        self.sync_tolerance_ms = tolerance_ms;
    }

    /// Set max buffer size
    pub fn set_max_buffer_size(&mut self, size: usize) {
        self.max_buffer_size = size;
    }
}

impl Default for StreamSynchronizer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_synchronizer_creation() {
        let sync = StreamSynchronizer::new();
        let (vision_size, audio_size) = sync.get_buffer_sizes().await;
        assert_eq!(vision_size, 0);
        assert_eq!(audio_size, 0);
    }

    #[tokio::test]
    async fn test_add_vision_frame() {
        let sync = StreamSynchronizer::new();

        let frame = VisionFrame {
            frame_id: "v1".to_string(),
            timestamp: Utc::now(),
            width: 640,
            height: 480,
            format: "rgb".to_string(),
            data: vec![],
            features: vec![],
        };

        sync.add_vision_frame(frame).await;

        let (vision_size, audio_size) = sync.get_buffer_sizes().await;
        assert_eq!(vision_size, 1);
        assert_eq!(audio_size, 0);
    }

    #[tokio::test]
    async fn test_add_audio_chunk() {
        let sync = StreamSynchronizer::new();

        let chunk = AudioChunk {
            chunk_id: "a1".to_string(),
            timestamp: Utc::now(),
            sample_rate: 44100,
            channels: 2,
            format: "pcm".to_string(),
            data: vec![],
            duration_ms: 20,
        };

        sync.add_audio_chunk(chunk).await;

        let (vision_size, audio_size) = sync.get_buffer_sizes().await;
        assert_eq!(vision_size, 0);
        assert_eq!(audio_size, 1);
    }

    #[tokio::test]
    async fn test_synchronize_empty() {
        let sync = StreamSynchronizer::new();
        let result = sync.synchronize(vec![], vec![]).await;
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_synchronize_matching() {
        let sync = StreamSynchronizer::new();

        let vision_frames = vec![
            VisionFrame {
                frame_id: "v1".to_string(),
                timestamp: Utc::now(),
                width: 640,
                height: 480,
                format: "rgb".to_string(),
                data: vec![],
                features: vec![],
            },
            VisionFrame {
                frame_id: "v2".to_string(),
                timestamp: Utc::now(),
                width: 640,
                height: 480,
                format: "rgb".to_string(),
                data: vec![],
                features: vec![],
            },
        ];

        let audio_chunks = vec![
            AudioChunk {
                chunk_id: "a1".to_string(),
                timestamp: Utc::now(),
                sample_rate: 44100,
                channels: 2,
                format: "pcm".to_string(),
                data: vec![],
                duration_ms: 20,
            },
            AudioChunk {
                chunk_id: "a2".to_string(),
                timestamp: Utc::now(),
                sample_rate: 44100,
                channels: 2,
                format: "pcm".to_string(),
                data: vec![],
                duration_ms: 20,
            },
        ];

        let result = sync.synchronize(vision_frames, audio_chunks).await;
        assert_eq!(result.len(), 2);

        // Check that both vision and audio are present
        assert!(result[0].vision_frame.is_some());
        assert!(result[0].audio_chunk.is_some());
    }

    #[tokio::test]
    async fn test_synchronize_mismatched_lengths() {
        let sync = StreamSynchronizer::new();

        let vision_frames = vec![VisionFrame {
            frame_id: "v1".to_string(),
            timestamp: Utc::now(),
            width: 640,
            height: 480,
            format: "rgb".to_string(),
            data: vec![],
            features: vec![],
        }];

        let audio_chunks = vec![
            AudioChunk {
                chunk_id: "a1".to_string(),
                timestamp: Utc::now(),
                sample_rate: 44100,
                channels: 2,
                format: "pcm".to_string(),
                data: vec![],
                duration_ms: 20,
            },
            AudioChunk {
                chunk_id: "a2".to_string(),
                timestamp: Utc::now(),
                sample_rate: 44100,
                channels: 2,
                format: "pcm".to_string(),
                data: vec![],
                duration_ms: 20,
            },
        ];

        let result = sync.synchronize(vision_frames, audio_chunks).await;
        assert_eq!(result.len(), 2); // Should use max length

        // First should have both
        assert!(result[0].vision_frame.is_some());
        assert!(result[0].audio_chunk.is_some());

        // Second should only have audio
        assert!(result[1].vision_frame.is_none());
        assert!(result[1].audio_chunk.is_some());
    }

    #[tokio::test]
    async fn test_clear_buffers() {
        let sync = StreamSynchronizer::new();

        sync.add_vision_frame(VisionFrame {
            frame_id: "v1".to_string(),
            timestamp: Utc::now(),
            width: 640,
            height: 480,
            format: "rgb".to_string(),
            data: vec![],
            features: vec![],
        })
        .await;

        sync.add_audio_chunk(AudioChunk {
            chunk_id: "a1".to_string(),
            timestamp: Utc::now(),
            sample_rate: 44100,
            channels: 2,
            format: "pcm".to_string(),
            data: vec![],
            duration_ms: 20,
        })
        .await;

        let (vision_before, audio_before) = sync.get_buffer_sizes().await;
        assert_eq!(vision_before, 1);
        assert_eq!(audio_before, 1);

        sync.clear_buffers().await;

        let (vision_after, audio_after) = sync.get_buffer_sizes().await;
        assert_eq!(vision_after, 0);
        assert_eq!(audio_after, 0);
    }

    #[tokio::test]
    async fn test_buffer_size_limit() {
        let mut sync = StreamSynchronizer::new();
        sync.set_max_buffer_size(5);

        // Add more frames than buffer size
        for i in 0..10 {
            sync.add_vision_frame(VisionFrame {
                frame_id: format!("v{}", i),
                timestamp: Utc::now(),
                width: 640,
                height: 480,
                format: "rgb".to_string(),
                data: vec![],
                features: vec![],
            })
            .await;
        }

        let (vision_size, _) = sync.get_buffer_sizes().await;
        assert_eq!(vision_size, 5); // Should be limited to max_buffer_size
    }

    #[test]
    fn test_synchronized_frame_creation() {
        let frame = SynchronizedFrame {
            sync_id: "sync_test".to_string(),
            timestamp: Utc::now(),
            vision_frame: None,
            audio_chunk: None,
            sync_offset_ms: 0,
        };

        assert_eq!(frame.sync_id, "sync_test");
        assert!(frame.vision_frame.is_none());
        assert!(frame.audio_chunk.is_none());
        assert_eq!(frame.sync_offset_ms, 0);
    }

    #[test]
    fn test_synchronized_frame_serialization() {
        let frame = SynchronizedFrame {
            sync_id: "sync_serial".to_string(),
            timestamp: Utc::now(),
            vision_frame: None,
            audio_chunk: None,
            sync_offset_ms: 10,
        };

        let serialized = serde_json::to_string(&frame).unwrap();
        assert!(serialized.contains("sync_serial"));
        assert!(serialized.contains("10"));
    }
}

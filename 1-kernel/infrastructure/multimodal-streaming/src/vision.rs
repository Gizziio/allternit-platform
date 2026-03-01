//! Vision Stream Processing
//!
//! Processes video/vision streams for agents.

use crate::{MultimodalError, StreamMetadata};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Processed vision frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionFrame {
    pub frame_id: String,
    pub timestamp: DateTime<Utc>,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub data: Vec<u8>,
    pub features: Vec<VisualFeature>,
}

/// Visual feature detected in frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualFeature {
    pub feature_id: String,
    pub feature_type: String,
    pub confidence: f32,
    pub bounding_box: Option<VisualBoundingBox>,
    pub label: Option<String>,
}

/// Visual bounding box
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualBoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Vision processor
pub struct VisionProcessor {
    frame_count: Arc<RwLock<u64>>,
    processing_enabled: Arc<RwLock<bool>>,
}

impl VisionProcessor {
    /// Create a new vision processor
    pub fn new() -> Self {
        Self {
            frame_count: Arc::new(RwLock::new(0)),
            processing_enabled: Arc::new(RwLock::new(true)),
        }
    }

    /// Process a vision frame
    pub async fn process_frame(
        &self,
        frame_data: &[u8],
        metadata: StreamMetadata,
    ) -> Result<VisionFrame, MultimodalError> {
        let enabled = *self.processing_enabled.read().await;
        if !enabled {
            return Err(MultimodalError::InvalidFrameFormat(
                "Vision processing disabled".to_string(),
            ));
        }

        // Validate frame data
        if frame_data.is_empty() {
            return Err(MultimodalError::InvalidFrameFormat(
                "Empty frame data".to_string(),
            ));
        }

        // Extract dimensions from metadata
        let width = metadata.width.unwrap_or(640);
        let height = metadata.height.unwrap_or(480);
        let format = metadata.format.unwrap_or_else(|| "rgb".to_string());

        // Increment frame count
        {
            let mut count = self.frame_count.write().await;
            *count += 1;
        }

        // In production, this would:
        // 1. Decode the image/video frame
        // 2. Run object detection
        // 3. Extract visual features
        // 4. Generate embeddings

        Ok(VisionFrame {
            frame_id: format!("frame_{}", Utc::now().timestamp_nanos()),
            timestamp: Utc::now(),
            width,
            height,
            format,
            data: frame_data.to_vec(),
            features: vec![], // Would be populated by detection algorithms
        })
    }

    /// Get current frame count
    pub async fn get_frame_count(&self) -> u64 {
        *self.frame_count.read().await
    }

    /// Enable/disable processing
    pub async fn set_processing_enabled(&self, enabled: bool) {
        let mut processing = self.processing_enabled.write().await;
        *processing = enabled;
    }

    /// Reset frame count
    pub async fn reset_frame_count(&self) {
        let mut count = self.frame_count.write().await;
        *count = 0;
    }
}

impl Default for VisionProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_vision_processor_creation() {
        let processor = VisionProcessor::new();
        let count = processor.get_frame_count().await;
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_frame_processing() {
        let processor = VisionProcessor::new();

        let frame_data = vec![0u8; 100];
        let metadata = StreamMetadata {
            width: Some(320),
            height: Some(240),
            format: Some("rgb".to_string()),
            ..Default::default()
        };

        let result = processor.process_frame(&frame_data, metadata).await;
        assert!(result.is_ok());

        let frame = result.unwrap();
        assert_eq!(frame.width, 320);
        assert_eq!(frame.height, 240);
        assert_eq!(frame.format, "rgb");
    }

    #[tokio::test]
    async fn test_empty_frame_rejected() {
        let processor = VisionProcessor::new();

        let metadata = StreamMetadata::default();
        let result = processor.process_frame(&[], metadata).await;

        assert!(result.is_err());
        assert!(matches!(
            result,
            Err(MultimodalError::InvalidFrameFormat(_))
        ));
    }

    #[tokio::test]
    async fn test_frame_count_increment() {
        let processor = VisionProcessor::new();

        let frame_data = vec![0u8; 50];
        let metadata = StreamMetadata::default();

        processor
            .process_frame(&frame_data, metadata.clone())
            .await
            .unwrap();
        processor
            .process_frame(&frame_data, metadata.clone())
            .await
            .unwrap();
        processor
            .process_frame(&frame_data, metadata)
            .await
            .unwrap();

        let count = processor.get_frame_count().await;
        assert_eq!(count, 3);
    }

    #[tokio::test]
    async fn test_processing_toggle() {
        let processor = VisionProcessor::new();

        // Disable processing
        processor.set_processing_enabled(false).await;

        let frame_data = vec![0u8; 50];
        let metadata = StreamMetadata::default();

        let result = processor.process_frame(&frame_data, metadata.clone()).await;
        assert!(result.is_err());

        // Re-enable processing
        processor.set_processing_enabled(true).await;

        let result = processor.process_frame(&frame_data, metadata).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_frame_count_reset() {
        let processor = VisionProcessor::new();

        let frame_data = vec![0u8; 50];
        let metadata = StreamMetadata::default();

        processor
            .process_frame(&frame_data, metadata.clone())
            .await
            .unwrap();
        processor
            .process_frame(&frame_data, metadata)
            .await
            .unwrap();

        let count_before = processor.get_frame_count().await;
        assert_eq!(count_before, 2);

        processor.reset_frame_count().await;

        let count_after = processor.get_frame_count().await;
        assert_eq!(count_after, 0);
    }

    #[test]
    fn test_visual_feature_creation() {
        let feature = VisualFeature {
            feature_id: "feat_1".to_string(),
            feature_type: "object".to_string(),
            confidence: 0.95,
            bounding_box: Some(VisualBoundingBox {
                x: 100.0,
                y: 150.0,
                width: 50.0,
                height: 30.0,
            }),
            label: Some("person".to_string()),
        };

        assert_eq!(feature.feature_id, "feat_1");
        assert_eq!(feature.confidence, 0.95);
        assert!(feature.bounding_box.is_some());
        assert_eq!(feature.label, Some("person".to_string()));
    }

    #[test]
    fn test_vision_frame_serialization() {
        let frame = VisionFrame {
            frame_id: "frame_test".to_string(),
            timestamp: Utc::now(),
            width: 1920,
            height: 1080,
            format: "rgb".to_string(),
            data: vec![0, 1, 2, 3],
            features: vec![],
        };

        let serialized = serde_json::to_string(&frame).unwrap();
        assert!(serialized.contains("frame_test"));
        assert!(serialized.contains("1920"));
        assert!(serialized.contains("1080"));
    }
}

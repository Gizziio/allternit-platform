//! Video Pipeline
//!
//! GAP-38: VisionChannel implementation
//! WIH: GAP-38, Owner: T2-A2
//!
//! This module is owned by T2-A2. These are placeholder exports
//! for coordination until T2-A2 implementation is complete.

use crate::types::{StreamingError, StreamingResult, VideoFrame};
use tokio::sync::mpsc;

/// Vision channel for receiving and processing video streams
///
/// Placeholder - full implementation by T2-A2
pub struct VisionChannel {
    channel_id: String,
    stream_id: String,
    frame_sender: mpsc::UnboundedSender<VideoFrame>,
}

impl VisionChannel {
    /// Create a new vision channel
    pub fn new(
        channel_id: impl Into<String>,
        stream_id: impl Into<String>,
    ) -> (Self, mpsc::UnboundedReceiver<VideoFrame>) {
        let (frame_sender, frame_receiver) = mpsc::unbounded_channel();

        let channel = Self {
            channel_id: channel_id.into(),
            stream_id: stream_id.into(),
            frame_sender,
        };

        (channel, frame_receiver)
    }

    /// Get channel ID
    pub fn channel_id(&self) -> &str {
        &self.channel_id
    }

    /// Get stream ID
    pub fn stream_id(&self) -> &str {
        &self.stream_id
    }

    /// Decode video data
    ///
    /// STUB_APPROVED: Full implementation by T2-A2
    pub async fn decode(
        &self,
        _encoded_data: &[u8],
        _timestamp: Option<chrono::DateTime<chrono::Utc>>,
        _sequence: u64,
    ) -> StreamingResult<VideoFrame> {
        // STUB_APPROVED: Full implementation by T2-A2
        Err(StreamingError::Codec(
            "VisionChannel.decode() not yet implemented - T2-A2 owns this".to_string(),
        ))
    }
}

/// Video decoder
///
/// Placeholder - full implementation by T2-A2
pub struct VideoDecoder;

impl VideoDecoder {
    /// Create a new video decoder
    pub fn new() -> Self {
        Self
    }
}

impl Default for VideoDecoder {
    fn default() -> Self {
        Self::new()
    }
}

/// Video buffer
///
/// Placeholder - full implementation by T2-A2
pub struct VideoBuffer;

impl VideoBuffer {
    /// Create a new video buffer
    pub fn new() -> Self {
        Self
    }
}

impl Default for VideoBuffer {
    fn default() -> Self {
        Self::new()
    }
}

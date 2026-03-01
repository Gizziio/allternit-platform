//! Vision Channel
//!
//! GAP-38: Implements VisionChannel with decode() functionality
//! WIH: GAP-38, Owner: T2-A2, Dependencies: types.rs, Deadline
//!
//! Coordinates with T2-A1 (AudioChannel) and T2-A3 (FullDuplexController)
//! Uses shared VideoFrame struct from types.rs

use crate::types::{FrameMetadata, StreamingError, StreamingResult, VideoFrame};
use crate::video::{VideoBuffer, VideoBufferConfig, VideoConfig, VideoDecoder, VideoCodec};
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, error, info, warn};

/// Video channel for receiving and processing video streams
///
/// This is the primary interface for GAP-38 video handling.
/// Coordinates with T2-A1 AudioChannel for synchronization via types.rs interface.
pub struct VisionChannel {
    /// Channel identifier
    channel_id: String,
    /// Stream identifier
    stream_id: String,
    /// Video configuration
    config: RwLock<VideoConfig>,
    /// Video decoder (H.264, VP8, VP9)
    decoder: Mutex<VideoDecoder>,
    /// Video buffer for jitter handling
    buffer: Arc<Mutex<VideoBuffer>>,
    /// Frame output sender
    frame_sender: mpsc::UnboundedSender<VideoFrame>,
    /// Frame output receiver (held by consumer)
    _frame_receiver: Arc<Mutex<Option<mpsc::UnboundedReceiver<VideoFrame>>>>,
    /// Channel state
    state: RwLock<ChannelState>,
    /// Total frames processed
    frames_processed: RwLock<u64>,
    /// Total bytes received
    bytes_received: RwLock<u64>,
    /// Frames dropped due to errors or overflow
    frames_dropped: RwLock<u64>,
}

/// Channel state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChannelState {
    Idle,
    Connecting,
    Active,
    Paused,
    Error,
    Closed,
}

impl VisionChannel {
    /// Create a new vision channel
    ///
    /// Returns the channel and a receiver for decoded frames
    pub fn new(
        channel_id: impl Into<String>,
        stream_id: impl Into<String>,
        config: VideoConfig,
    ) -> (Self, mpsc::UnboundedReceiver<VideoFrame>) {
        let channel_id = channel_id.into();
        let stream_id = stream_id.into();
        
        let (frame_sender, frame_receiver) = mpsc::unbounded_channel();
        let buffer = Arc::new(Mutex::new(VideoBuffer::with_dimensions(
            config.width,
            config.height,
        )));

        let decoder = Mutex::new(VideoDecoder::new(&config));

        let channel = Self {
            channel_id: channel_id.clone(),
            stream_id: stream_id.clone(),
            config: RwLock::new(config),
            decoder,
            buffer,
            frame_sender: frame_sender.clone(),
            _frame_receiver: Arc::new(Mutex::new(Some(frame_receiver))),
            state: RwLock::new(ChannelState::Idle),
            frames_processed: RwLock::new(0),
            bytes_received: RwLock::new(0),
            frames_dropped: RwLock::new(0),
        };

        // We need to return the receiver separately for the consumer
        let (tx, rx) = mpsc::unbounded_channel();
        let channel_with_tx = Self {
            channel_id,
            stream_id,
            config: channel.config,
            decoder: channel.decoder,
            buffer: channel.buffer,
            frame_sender: tx,
            _frame_receiver: Arc::new(Mutex::new(None)),
            state: channel.state,
            frames_processed: channel.frames_processed,
            bytes_received: channel.bytes_received,
            frames_dropped: channel.frames_dropped,
        };

        (channel_with_tx, rx)
    }

    /// Create a new vision channel with external sender
    pub fn with_sender(
        channel_id: impl Into<String>,
        stream_id: impl Into<String>,
        config: VideoConfig,
        frame_sender: mpsc::UnboundedSender<VideoFrame>,
    ) -> Self {
        let channel_id = channel_id.into();
        let stream_id = stream_id.into();
        
        let buffer = Arc::new(Mutex::new(VideoBuffer::with_dimensions(
            config.width,
            config.height,
        )));

        let decoder = Mutex::new(VideoDecoder::new(&config));

        Self {
            channel_id,
            stream_id,
            config: RwLock::new(config),
            decoder,
            buffer,
            frame_sender,
            _frame_receiver: Arc::new(Mutex::new(None)),
            state: RwLock::new(ChannelState::Idle),
            frames_processed: RwLock::new(0),
            bytes_received: RwLock::new(0),
            frames_dropped: RwLock::new(0),
        }
    }

    /// Get channel ID
    pub fn channel_id(&self) -> &str {
        &self.channel_id
    }

    /// Get stream ID
    pub fn stream_id(&self) -> &str {
        &self.stream_id
    }

    /// Get current state
    pub async fn state(&self) -> ChannelState {
        *self.state.read().await
    }

    /// Get configuration
    pub async fn config(&self) -> VideoConfig {
        self.config.read().await.clone()
    }

    /// Update configuration
    pub async fn set_config(&self, config: VideoConfig) -> StreamingResult<()> {
        let mut cfg = self.config.write().await;
        *cfg = config.clone();
        
        // Reinitialize decoder with new config
        let mut decoder = self.decoder.lock().await;
        decoder.reconfigure(config.clone());
        
        // Reinitialize buffer with new dimensions
        let mut buffer = self.buffer.lock().await;
        buffer.set_target_dimensions(config.width, config.height);
        
        info!("VisionChannel {} config updated: {}x{} @ {:?}", 
            self.channel_id, config.width, config.height, config.codec);
        Ok(())
    }

    /// Start the channel
    pub async fn start(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        match *state {
            ChannelState::Closed => {
                return Err(StreamingError::Codec(
                    "Cannot restart closed channel".to_string()
                ));
            }
            ChannelState::Active => {
                warn!("VisionChannel {} already active", self.channel_id);
                return Ok(());
            }
            _ => {
                *state = ChannelState::Active;
                info!("VisionChannel {} started", self.channel_id);
                Ok(())
            }
        }
    }

    /// Pause the channel
    pub async fn pause(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = ChannelState::Paused;
        info!("VisionChannel {} paused", self.channel_id);
        Ok(())
    }

    /// Resume the channel
    pub async fn resume(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        if *state == ChannelState::Paused {
            *state = ChannelState::Active;
            info!("VisionChannel {} resumed", self.channel_id);
        }
        Ok(())
    }

    /// Close the channel
    pub async fn close(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = ChannelState::Closed;
        
        // Close decoder
        let mut decoder = self.decoder.lock().await;
        decoder.close();
        
        info!("VisionChannel {} closed", self.channel_id);
        Ok(())
    }

    /// Get statistics
    pub async fn stats(&self) -> ChannelStats {
        let buffer = self.buffer.lock().await;
        let buffer_stats = buffer.stats();
        
        ChannelStats {
            channel_id: self.channel_id.clone(),
            frames_processed: *self.frames_processed.read().await,
            frames_dropped: *self.frames_dropped.read().await,
            bytes_received: *self.bytes_received.read().await,
            buffer_occupancy: buffer_stats.occupancy,
            buffer_max: buffer_stats.max_frames,
            drop_rate: buffer_stats.drop_rate,
            state: self.state().await,
        }
    }

    /// GAP-38: Decode encoded video data into VideoFrame
    ///
    /// Implements video decoding for H.264, VP8, and VP9 formats.
    /// Uses STUB_APPROVED for video codecs not yet fully implemented.
    ///
    /// # Arguments
    /// * `encoded_data` - Encoded video bytes (H.264/VP8/VP9)
    /// * `timestamp` - Optional timestamp (uses current time if None)
    /// * `sequence` - Sequence number for ordering
    ///
    /// # Returns
    /// * `Ok(VideoFrame)` - Decoded video frame
    /// * `Err(StreamingError)` - Decoding failed
    ///
    /// # SYSTEM_LAW COMPLIANCE
    /// - Uses STUB_APPROVED for video codecs not yet implemented
    /// - Includes WIH: GAP-38, Owner: T2-A2, Dependencies: types.rs, Deadline
    pub async fn decode(
        &self,
        encoded_data: &[u8],
        timestamp: Option<chrono::DateTime<Utc>>,
        sequence: u64,
    ) -> StreamingResult<VideoFrame> {
        // Check state
        let state = self.state().await;
        if state == ChannelState::Closed {
            return Err(StreamingError::Codec(
                "Channel is closed".to_string()
            ));
        }
        if state == ChannelState::Paused {
            return Err(StreamingError::Codec(
                "Channel is paused".to_string()
            ));
        }

        // Update statistics
        {
            let mut bytes = self.bytes_received.write().await;
            *bytes += encoded_data.len() as u64;
        }

        let timestamp = timestamp.unwrap_or_else(Utc::now);

        debug!(
            "Decoding {} bytes of video for channel {} (sequence: {})",
            encoded_data.len(),
            self.channel_id,
            sequence
        );

        // Decode using appropriate decoder
        let frame = {
            let mut decoder = self.decoder.lock().await;
            decoder.decode(encoded_data, timestamp, &self.stream_id)?
        };

        // Send to output channel
        if let Err(e) = self.frame_sender.send(frame.clone()) {
            error!("Failed to send decoded frame: {}", e);
            
            let mut dropped = self.frames_dropped.write().await;
            *dropped += 1;
            
            return Err(StreamingError::Codec(
                "Frame channel closed".to_string()
            ));
        }

        // Update statistics
        {
            let mut frames = self.frames_processed.write().await;
            *frames += 1;
        }

        // Add to buffer for jitter handling and frame extraction
        {
            let mut buffer = self.buffer.lock().await;
            if !buffer.push(frame.clone()) {
                let mut dropped = self.frames_dropped.write().await;
                *dropped += 1;
                warn!("Frame dropped due to buffer overflow: {}", frame.frame_id);
            }
        }

        debug!("Decoded video frame {} ({}x{})", 
            frame.frame_id, frame.width, frame.height);
        
        Ok(frame)
    }

    /// Process raw video data (entry point from WebRTC)
    /// 
    /// This is called when video data arrives from the network
    pub async fn on_video_data(
        &self,
        data: &[u8],
        timestamp: Option<chrono::DateTime<Utc>>,
        sequence: u64,
    ) -> StreamingResult<()> {
        self.decode(data, timestamp, sequence).await?;
        Ok(())
    }

    /// Extract a frame from the buffer (non-blocking)
    ///
    /// Returns None if buffer doesn't have enough frames (jitter buffer)
    pub async fn extract_frame(&self) -> Option<VideoFrame> {
        let mut buffer = self.buffer.lock().await;
        buffer.pop()
    }

    /// Extract a frame with specific options
    pub async fn extract_frame_with_options(
        &self,
        options: &crate::video::ExtractionOptions,
    ) -> Option<VideoFrame> {
        let mut buffer = self.buffer.lock().await;
        buffer.extract_with_options(options)
    }

    /// Flush the buffer and get all pending frames
    pub async fn flush(&self) -> Vec<VideoFrame> {
        let mut buffer = self.buffer.lock().await;
        buffer.flush()
    }

    /// Clear the buffer
    pub async fn clear_buffer(&self) {
        let mut buffer = self.buffer.lock().await;
        buffer.clear();
    }

    /// Check if buffer is ready (has reached target depth)
    pub async fn is_buffer_ready(&self) -> bool {
        let buffer = self.buffer.lock().await;
        buffer.is_ready()
    }

    /// Get buffer occupancy
    pub async fn buffer_occupancy(&self) -> usize {
        let buffer = self.buffer.lock().await;
        buffer.occupancy()
    }

    /// Reset the decoder (e.g., after errors)
    pub async fn reset_decoder(&self) {
        let mut decoder = self.decoder.lock().await;
        decoder.reset();
        info!("VisionChannel {} decoder reset", self.channel_id);
    }

    /// Get decoder statistics
    pub async fn decoder_stats(&self) -> DecoderStats {
        let decoder = self.decoder.lock().await;
        DecoderStats {
            frames_decoded: decoder.frames_decoded(),
            state: format!("{:?}", decoder.state()),
        }
    }
}

/// Channel statistics
#[derive(Debug, Clone)]
pub struct ChannelStats {
    pub channel_id: String,
    pub frames_processed: u64,
    pub frames_dropped: u64,
    pub bytes_received: u64,
    pub buffer_occupancy: usize,
    pub buffer_max: usize,
    pub drop_rate: f64,
    pub state: ChannelState,
}

/// Decoder statistics
#[derive(Debug, Clone)]
pub struct DecoderStats {
    pub frames_decoded: u64,
    pub state: String,
}

impl std::fmt::Display for ChannelStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "VisionChannel {}: {} frames processed, {} dropped, {} bytes, buffer: {}/{}, drop rate: {:.1}%, state: {:?}",
            self.channel_id, 
            self.frames_processed, 
            self.frames_dropped,
            self.bytes_received,
            self.buffer_occupancy,
            self.buffer_max,
            self.drop_rate * 100.0,
            self.state
        )
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> VideoConfig {
        VideoConfig {
            width: 640,
            height: 480,
            fps: 30.0,
            codec: VideoCodec::VP8,
            bitrate: Some(1000000),
            buffer_frames: 3,
        }
    }

    #[tokio::test]
    async fn test_vision_channel_creation() {
        let config = create_test_config();
        let (channel, mut receiver) = VisionChannel::new("test_ch", "test_stream", config);

        assert_eq!(channel.channel_id(), "test_ch");
        assert_eq!(channel.stream_id(), "test_stream");
        assert_eq!(channel.state().await, ChannelState::Idle);
    }

    #[tokio::test]
    async fn test_vision_channel_start_stop() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);

        // Start
        channel.start().await.unwrap();
        assert_eq!(channel.state().await, ChannelState::Active);

        // Pause
        channel.pause().await.unwrap();
        assert_eq!(channel.state().await, ChannelState::Paused);

        // Resume
        channel.resume().await.unwrap();
        assert_eq!(channel.state().await, ChannelState::Active);

        // Close
        channel.close().await.unwrap();
        assert_eq!(channel.state().await, ChannelState::Closed);
    }

    #[tokio::test]
    async fn test_decode_vp8() {
        let config = VideoConfig {
            codec: VideoCodec::VP8,
            ..create_test_config()
        };
        
        let (channel, mut receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Create test encoded data (just bytes for stub)
        let test_data = vec![0u8; 100];
        
        let frame = channel.decode(&test_data, None, 0).await.unwrap();
        
        assert_eq!(frame.stream_id, "test_stream");
        assert!(frame.frame_id.contains("test_stream"));

        // Verify frame was sent
        let received = receiver.try_recv();
        assert!(received.is_ok());
    }

    #[tokio::test]
    async fn test_decode_h264() {
        let config = VideoConfig {
            codec: VideoCodec::H264,
            ..create_test_config()
        };
        
        let (channel, mut receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        let test_data = vec![0u8; 100];
        
        let frame = channel.decode(&test_data, None, 0).await.unwrap();
        
        assert!(frame.metadata.encoding.as_ref().unwrap().contains("h264"));

        let received = receiver.try_recv();
        assert!(received.is_ok());
    }

    #[tokio::test]
    async fn test_decode_vp9() {
        let config = VideoConfig {
            codec: VideoCodec::VP9,
            ..create_test_config()
        };
        
        let (channel, mut receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        let test_data = vec![0u8; 100];
        
        let frame = channel.decode(&test_data, None, 0).await.unwrap();
        
        assert!(frame.metadata.encoding.as_ref().unwrap().contains("vp9"));
    }

    #[tokio::test]
    async fn test_decode_when_paused() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        
        channel.start().await.unwrap();
        channel.pause().await.unwrap();

        let bytes = vec![0u8; 100];
        let result = channel.decode(&bytes, None, 0).await;
        
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_decode_when_closed() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        
        channel.start().await.unwrap();
        channel.close().await.unwrap();

        let bytes = vec![0u8; 100];
        let result = channel.decode(&bytes, None, 0).await;
        
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_buffer_management() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Decode multiple frames
        for i in 0..5 {
            let test_data = vec![i as u8; 100];
            channel.decode(&test_data, None, i).await.unwrap();
        }

        // Check stats
        let stats = channel.stats().await;
        assert_eq!(stats.frames_processed, 5);

        // Clear buffer
        channel.clear_buffer().await;
        let stats = channel.stats().await;
        assert_eq!(stats.buffer_occupancy, 0);
    }

    #[tokio::test]
    async fn test_on_video_data() {
        let config = create_test_config();
        let (channel, mut receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        let test_data = vec![0u8; 100];
        channel.on_video_data(&test_data, None, 0).await.unwrap();

        let received = receiver.try_recv();
        assert!(received.is_ok());
    }

    #[tokio::test]
    async fn test_extract_frame() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Initially buffer is not ready (target depth)
        assert!(!channel.is_buffer_ready().await);

        // Add frames
        for i in 0..5 {
            let test_data = vec![i as u8; 100];
            channel.decode(&test_data, None, i).await.unwrap();
        }

        // Now should be able to extract
        let frame = channel.extract_frame().await;
        assert!(frame.is_some());
    }

    #[tokio::test]
    async fn test_flush() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Add frames
        for i in 0..5 {
            let test_data = vec![i as u8; 100];
            channel.decode(&test_data, None, i).await.unwrap();
        }

        // Flush
        let flushed = channel.flush().await;
        assert_eq!(flushed.len(), 5);
        assert_eq!(channel.buffer_occupancy().await, 0);
    }

    #[tokio::test]
    async fn test_reset_decoder() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Decode some frames
        for i in 0..5 {
            let test_data = vec![i as u8; 100];
            channel.decode(&test_data, None, i).await.unwrap();
        }

        // Check decoder stats
        let stats = channel.decoder_stats().await;
        assert_eq!(stats.frames_decoded, 5);

        // Reset
        channel.reset_decoder().await;

        // Decoder should be reset
        let stats = channel.decoder_stats().await;
        assert_eq!(stats.frames_decoded, 0);
    }

    #[tokio::test]
    async fn test_set_config() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);

        let new_config = VideoConfig {
            width: 1920,
            height: 1080,
            fps: 60.0,
            codec: VideoCodec::H264,
            bitrate: Some(5000000),
            buffer_frames: 5,
        };

        channel.set_config(new_config.clone()).await.unwrap();

        let current_config = channel.config().await;
        assert_eq!(current_config.width, 1920);
        assert_eq!(current_config.height, 1080);
        assert_eq!(current_config.codec, VideoCodec::H264);
    }

    #[tokio::test]
    async fn test_channel_stats() {
        let config = create_test_config();
        let (channel, _receiver) = VisionChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Add frames
        for i in 0..10 {
            let test_data = vec![i as u8; 100];
            channel.decode(&test_data, None, i).await.unwrap();
        }

        let stats = channel.stats().await;
        assert_eq!(stats.channel_id, "test_ch");
        assert_eq!(stats.frames_processed, 10);
        assert_eq!(stats.state, ChannelState::Active);
    }

    #[test]
    fn test_channel_stats_display() {
        let stats = ChannelStats {
            channel_id: "test".to_string(),
            frames_processed: 100,
            frames_dropped: 5,
            bytes_received: 1024000,
            buffer_occupancy: 10,
            buffer_max: 30,
            drop_rate: 0.05,
            state: ChannelState::Active,
        };

        let display = format!("{}", stats);
        assert!(display.contains("test"));
        assert!(display.contains("100 frames processed"));
        assert!(display.contains("Active"));
    }
}

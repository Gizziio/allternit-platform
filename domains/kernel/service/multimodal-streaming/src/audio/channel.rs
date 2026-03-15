//! Audio Channel
//!
//! GAP-37: Implements AudioChannel with decode() functionality
//! Coordinates with T2-A2 (VisionChannel) and T2-A3 (FullDuplexController)

use crate::audio::{AudioBuffer, AudioDecoder};
use crate::types::{
    AudioCodec, AudioConfig, AudioFrame, FrameMetadata, StreamingError, StreamingResult,
};
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, error, info, warn};

/// Audio channel for receiving and processing audio streams
///
/// This is the primary interface for GAP-37 audio handling.
/// Coordinates with T2-A2 VisionChannel for synchronization.
pub struct AudioChannel {
    /// Channel identifier
    channel_id: String,
    /// Stream identifier
    stream_id: String,
    /// Audio configuration
    config: RwLock<AudioConfig>,
    /// Audio decoder (Opus/PCM)
    decoder: Mutex<AudioDecoder>,
    /// Audio buffer for jitter handling
    buffer: Arc<Mutex<AudioBuffer>>,
    /// Frame output sender
    frame_sender: mpsc::UnboundedSender<AudioFrame>,
    /// Frame output receiver (held by consumer)
    _frame_receiver: Arc<Mutex<Option<mpsc::UnboundedReceiver<AudioFrame>>>>,
    /// Channel state
    state: RwLock<ChannelState>,
    /// Total frames processed
    frames_processed: RwLock<u64>,
    /// Total bytes received
    bytes_received: RwLock<u64>,
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

impl AudioChannel {
    /// Create a new audio channel
    pub fn new(
        channel_id: impl Into<String>,
        stream_id: impl Into<String>,
        config: AudioConfig,
    ) -> (Self, mpsc::UnboundedReceiver<AudioFrame>) {
        let channel_id = channel_id.into();
        let stream_id = stream_id.into();

        let (frame_sender, frame_receiver) = mpsc::unbounded_channel();
        let buffer = Arc::new(Mutex::new(AudioBuffer::new(
            config.sample_rate,
            config.channels,
            config.buffer_ms,
        )));

        let decoder = Mutex::new(AudioDecoder::new(&config));

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
        };

        (channel_with_tx, rx)
    }

    /// Create a new audio channel with external sender
    pub fn with_sender(
        channel_id: impl Into<String>,
        stream_id: impl Into<String>,
        config: AudioConfig,
        frame_sender: mpsc::UnboundedSender<AudioFrame>,
    ) -> Self {
        let channel_id = channel_id.into();
        let stream_id = stream_id.into();

        let buffer = Arc::new(Mutex::new(AudioBuffer::new(
            config.sample_rate,
            config.channels,
            config.buffer_ms,
        )));

        let decoder = Mutex::new(AudioDecoder::new(&config));

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
    pub async fn config(&self) -> AudioConfig {
        self.config.read().await.clone()
    }

    /// Update configuration
    pub async fn set_config(&self, config: AudioConfig) -> StreamingResult<()> {
        // Reinitialize decoder with new config
        let mut decoder = self.decoder.lock().await;
        *decoder = AudioDecoder::new(&config);

        // Reinitialize buffer
        let mut buffer = self.buffer.lock().await;
        *buffer = AudioBuffer::new(config.sample_rate, config.channels, config.buffer_ms);

        // Update config last (it gets moved)
        let mut cfg = self.config.write().await;
        *cfg = config;

        info!("AudioChannel {} config updated", self.channel_id);
        Ok(())
    }

    /// Start the channel
    pub async fn start(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        match *state {
            ChannelState::Closed => {
                return Err(StreamingError::AudioProcessing(
                    "Cannot restart closed channel".to_string(),
                ));
            }
            ChannelState::Active => {
                warn!("AudioChannel {} already active", self.channel_id);
                return Ok(());
            }
            _ => {
                *state = ChannelState::Active;
                info!("AudioChannel {} started", self.channel_id);
                Ok(())
            }
        }
    }

    /// Pause the channel
    pub async fn pause(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = ChannelState::Paused;
        info!("AudioChannel {} paused", self.channel_id);
        Ok(())
    }

    /// Resume the channel
    pub async fn resume(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        if *state == ChannelState::Paused {
            *state = ChannelState::Active;
            info!("AudioChannel {} resumed", self.channel_id);
        }
        Ok(())
    }

    /// Close the channel
    pub async fn close(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = ChannelState::Closed;
        info!("AudioChannel {} closed", self.channel_id);
        Ok(())
    }

    /// Get statistics
    pub async fn stats(&self) -> ChannelStats {
        ChannelStats {
            channel_id: self.channel_id.clone(),
            frames_processed: *self.frames_processed.read().await,
            bytes_received: *self.bytes_received.read().await,
            buffer_occupancy: self.buffer.lock().await.occupancy(),
            state: self.state().await,
        }
    }

    /// GAP-37: Decode encoded audio data into AudioFrame
    ///
    /// # Arguments
    /// * `encoded_data` - Encoded audio bytes (Opus/PCM)
    /// * `timestamp` - Optional timestamp (uses current time if None)
    /// * `sequence` - Sequence number for ordering
    ///
    /// # Returns
    /// * `Ok(AudioFrame)` - Decoded audio frame
    /// * `Err(StreamingError)` - Decoding failed
    ///
    /// # SYSTEM_LAW COMPLIANCE
    /// Uses STUB_APPROVED for audio codecs not yet fully implemented.
    pub async fn decode(
        &self,
        encoded_data: &[u8],
        timestamp: Option<chrono::DateTime<Utc>>,
        sequence: u64,
    ) -> StreamingResult<AudioFrame> {
        // Check state
        let state = self.state().await;
        if state == ChannelState::Closed {
            return Err(StreamingError::AudioProcessing(
                "Channel is closed".to_string(),
            ));
        }
        if state == ChannelState::Paused {
            return Err(StreamingError::AudioProcessing(
                "Channel is paused".to_string(),
            ));
        }

        // Update statistics
        {
            let mut bytes = self.bytes_received.write().await;
            *bytes += encoded_data.len() as u64;
        }

        let config = self.config.read().await.clone();
        let timestamp = timestamp.unwrap_or_else(Utc::now);

        debug!(
            "Decoding {} bytes of {} audio for channel {}",
            encoded_data.len(),
            format!("{:?}", config.codec).to_lowercase(),
            self.channel_id
        );

        // Decode using appropriate decoder
        let samples = {
            let mut decoder = self.decoder.lock().await;
            decoder.decode(encoded_data)?
        };

        // Calculate duration based on samples and config
        let samples_per_channel = samples.len() / config.channels as usize;
        let duration_ms =
            ((samples_per_channel as f64 / config.sample_rate as f64) * 1000.0) as u64;

        // Create frame
        let frame = AudioFrame {
            frame_id: format!("{}_{}_{}", self.channel_id, self.stream_id, sequence),
            stream_id: self.stream_id.clone(),
            timestamp,
            samples,
            sample_rate: config.sample_rate,
            channels: config.channels,
            duration_ms,
            metadata: FrameMetadata {
                encoding: Some(format!("{:?}", config.codec).to_lowercase()),
                source: Some("webrtc".to_string()),
                sequence: Some(sequence),
                extra: Default::default(),
            },
        };

        // Send to output
        if let Err(e) = self.frame_sender.send(frame.clone()) {
            error!("Failed to send decoded frame: {}", e);
            return Err(StreamingError::AudioProcessing(
                "Frame channel closed".to_string(),
            ));
        }

        // Update statistics
        {
            let mut frames = self.frames_processed.write().await;
            *frames += 1;
        }

        // Add to buffer for jitter handling
        {
            let mut buffer = self.buffer.lock().await;
            buffer.push(frame.clone());
        }

        debug!(
            "Decoded audio frame {} with {} samples",
            frame.frame_id,
            frame.samples.len()
        );
        Ok(frame)
    }

    /// Process raw audio data (entry point from WebRTC)
    ///
    /// This is called when audio data arrives from the network
    pub async fn on_audio_data(
        &self,
        data: &[u8],
        timestamp: Option<chrono::DateTime<Utc>>,
        sequence: u64,
    ) -> StreamingResult<()> {
        self.decode(data, timestamp, sequence).await?;
        Ok(())
    }

    /// Flush the buffer and get all pending frames
    pub async fn flush(&self) -> Vec<AudioFrame> {
        let mut buffer = self.buffer.lock().await;
        buffer.flush()
    }

    /// Get next frame from buffer (non-blocking)
    pub async fn next_frame(&self) -> Option<AudioFrame> {
        let mut buffer = self.buffer.lock().await;
        buffer.pop()
    }

    /// Clear the buffer
    pub async fn clear_buffer(&self) {
        let mut buffer = self.buffer.lock().await;
        buffer.clear();
    }
}

/// Channel statistics
#[derive(Debug, Clone)]
pub struct ChannelStats {
    pub channel_id: String,
    pub frames_processed: u64,
    pub bytes_received: u64,
    pub buffer_occupancy: usize,
    pub state: ChannelState,
}

impl std::fmt::Display for ChannelStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "AudioChannel {}: {} frames, {} bytes, buffer: {}, state: {:?}",
            self.channel_id,
            self.frames_processed,
            self.bytes_received,
            self.buffer_occupancy,
            self.state
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> AudioConfig {
        AudioConfig {
            sample_rate: 48000,
            channels: 2,
            codec: AudioCodec::PcmF32,
            bitrate: None,
            buffer_ms: 20,
        }
    }

    #[tokio::test]
    async fn test_audio_channel_creation() {
        let config = create_test_config();
        let (channel, _receiver) = AudioChannel::new("test_ch", "test_stream", config);

        assert_eq!(channel.channel_id(), "test_ch");
        assert_eq!(channel.stream_id(), "test_stream");
        assert_eq!(channel.state().await, ChannelState::Idle);
    }

    #[tokio::test]
    async fn test_audio_channel_start_stop() {
        let config = create_test_config();
        let (channel, _receiver) = AudioChannel::new("test_ch", "test_stream", config);

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
    async fn test_decode_pcm() {
        let config = AudioConfig {
            sample_rate: 48000,
            channels: 2,
            codec: AudioCodec::PcmF32,
            bitrate: None,
            buffer_ms: 20,
        };

        let (channel, mut receiver) = AudioChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Create test PCM data (f32 samples as bytes)
        let samples: Vec<f32> = vec![0.0, 0.5, 1.0, 0.5, 0.0, -0.5];
        let bytes: Vec<u8> = samples
            .iter()
            .flat_map(|s| s.to_le_bytes().to_vec())
            .collect();

        let frame = channel.decode(&bytes, None, 0).await.unwrap();

        assert_eq!(frame.sample_rate, 48000);
        assert_eq!(frame.channels, 2);
        assert_eq!(frame.samples.len(), 6);

        // Verify frame was sent
        let received = receiver.try_recv();
        assert!(received.is_ok());
    }

    #[tokio::test]
    async fn test_decode_when_paused() {
        let config = create_test_config();
        let (channel, _receiver) = AudioChannel::new("test_ch", "test_stream", config);

        channel.start().await.unwrap();
        channel.pause().await.unwrap();

        let bytes = vec![0u8; 100];
        let result = channel.decode(&bytes, None, 0).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_buffer_management() {
        let config = create_test_config();
        let (channel, _receiver) = AudioChannel::new("test_ch", "test_stream", config);
        channel.start().await.unwrap();

        // Decode multiple frames
        for i in 0..5 {
            let samples: Vec<f32> = vec![0.0, 0.5, 1.0];
            let bytes: Vec<u8> = samples
                .iter()
                .flat_map(|s| s.to_le_bytes().to_vec())
                .collect();

            channel.decode(&bytes, None, i).await.unwrap();
        }

        // Check stats
        let stats = channel.stats().await;
        assert_eq!(stats.frames_processed, 5);
        assert_eq!(stats.buffer_occupancy, 5);

        // Clear buffer
        channel.clear_buffer().await;
        let stats = channel.stats().await;
        assert_eq!(stats.buffer_occupancy, 0);
    }

    #[test]
    fn test_channel_stats_display() {
        let stats = ChannelStats {
            channel_id: "test".to_string(),
            frames_processed: 100,
            bytes_received: 10240,
            buffer_occupancy: 5,
            state: ChannelState::Active,
        };

        let display = format!("{}", stats);
        assert!(display.contains("test"));
        assert!(display.contains("100 frames"));
        assert!(display.contains("Active"));
    }
}

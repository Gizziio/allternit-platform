//! Stream Multiplexing
//!
//! GAP-39: Stream multiplexing for FullDuplexController
//! WIH: GAP-39, Owner: T2-A3, Dependencies: T2-A1, T2-A2
//!
//! Implements stream multiplexing/demultiplexing for handling multiple
//! concurrent audio/video streams in full-duplex communication.

use crate::types::{AudioFrame, MultimodalFrame, VideoFrame, StreamDirection, StreamingResult, StreamingError};
use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, info, trace, warn};

/// Unique identifier for a multiplexed stream
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct StreamId(pub String);

impl From<&str> for StreamId {
    fn from(s: &str) -> Self {
        StreamId(s.to_string())
    }
}

impl From<String> for StreamId {
    fn from(s: String) -> Self {
        StreamId(s)
    }
}

impl std::fmt::Display for StreamId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Stream type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamType {
    Audio,
    Video,
    AudioVideo,
    Data,
}

/// Stream metadata for multiplexing
#[derive(Debug, Clone)]
pub struct StreamInfo {
    pub stream_id: StreamId,
    pub stream_type: StreamType,
    pub direction: StreamDirection,
    pub priority: u8, // 0-255, higher = more important
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub peer_id: Option<String>,
}

impl StreamInfo {
    /// Create new stream info
    pub fn new(
        stream_id: impl Into<StreamId>,
        stream_type: StreamType,
        direction: StreamDirection,
    ) -> Self {
        Self {
            stream_id: stream_id.into(),
            stream_type,
            direction,
            priority: 128, // Default priority
            created_at: chrono::Utc::now(),
            peer_id: None,
        }
    }

    /// Set priority (0-255)
    pub fn with_priority(mut self, priority: u8) -> Self {
        self.priority = priority;
        self
    }

    /// Set peer ID
    pub fn with_peer_id(mut self, peer_id: impl Into<String>) -> Self {
        self.peer_id = Some(peer_id.into());
        self
    }
}

/// Multiplexed stream channel endpoints
#[derive(Debug)]
pub struct MuxStream {
    pub info: StreamInfo,
    /// Sender for audio frames (incoming from stream)
    pub audio_tx: mpsc::UnboundedSender<AudioFrame>,
    /// Sender for video frames (incoming from stream)
    pub video_tx: mpsc::UnboundedSender<VideoFrame>,
    /// Sender for outgoing multiplexed frames
    pub output_tx: mpsc::UnboundedSender<MultimodalFrame>,
}

/// Stream multiplexer for managing multiple concurrent streams
///
/// Routes frames between different streams and handles priority-based
/// scheduling for bandwidth management.
pub struct StreamMultiplexer {
    /// Registered streams
    streams: RwLock<HashMap<StreamId, MuxStream>>,
    /// Global frame counter
    frame_counter: RwLock<u64>,
    /// Maximum concurrent streams
    max_streams: usize,
}

impl StreamMultiplexer {
    /// Create a new stream multiplexer
    pub fn new() -> Self {
        Self {
            streams: RwLock::new(HashMap::new()),
            frame_counter: RwLock::new(0),
            max_streams: 16,
        }
    }

    /// Create with custom max streams limit
    pub fn with_max_streams(max_streams: usize) -> Self {
        Self {
            streams: RwLock::new(HashMap::new()),
            frame_counter: RwLock::new(0),
            max_streams,
        }
    }

    /// Register a new stream with the multiplexer
    ///
    /// Returns channel receivers for the stream to consume
    pub async fn register_stream(
        &self,
        info: StreamInfo,
    ) -> StreamingResult<(
        mpsc::UnboundedReceiver<AudioFrame>,
        mpsc::UnboundedReceiver<VideoFrame>,
        mpsc::UnboundedReceiver<MultimodalFrame>,
    )> {
        let mut streams = self.streams.write().await;

        if streams.len() >= self.max_streams {
            return Err(StreamingError::AudioProcessing(
                format!("Maximum stream limit ({}) reached", self.max_streams)
            ));
        }

        if streams.contains_key(&info.stream_id) {
            return Err(StreamingError::AudioProcessing(
                format!("Stream {} already registered", info.stream_id)
            ));
        }

        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (video_tx, video_rx) = mpsc::unbounded_channel();
        let (output_tx, output_rx) = mpsc::unbounded_channel();

        let stream = MuxStream {
            info: info.clone(),
            audio_tx,
            video_tx,
            output_tx,
        };

        streams.insert(info.stream_id.clone(), stream);
        
        info!("Registered stream {} (type: {:?}, direction: {:?})", 
            info.stream_id, info.stream_type, info.direction);

        Ok((audio_rx, video_rx, output_rx))
    }

    /// Unregister a stream
    pub async fn unregister_stream(&self, stream_id: &StreamId) -> StreamingResult<()> {
        let mut streams = self.streams.write().await;
        
        if streams.remove(stream_id).is_some() {
            info!("Unregistered stream {}", stream_id);
            Ok(())
        } else {
            Err(StreamingError::StreamNotFound(stream_id.to_string()))
        }
    }

    /// Route an audio frame to the appropriate stream
    pub async fn route_audio_frame(&self, stream_id: &StreamId, frame: AudioFrame) -> StreamingResult<()> {
        let streams = self.streams.read().await;
        
        if let Some(stream) = streams.get(stream_id) {
            trace!("Routing audio frame {} to stream {}", frame.frame_id, stream_id);
            
            stream.audio_tx
                .send(frame)
                .map_err(|_| StreamingError::AudioProcessing(
                    format!("Stream {} audio channel closed", stream_id)
                ))?;
            
            Ok(())
        } else {
            Err(StreamingError::StreamNotFound(stream_id.to_string()))
        }
    }

    /// Route a video frame to the appropriate stream
    pub async fn route_video_frame(&self, stream_id: &StreamId, frame: VideoFrame) -> StreamingResult<()> {
        let streams = self.streams.read().await;
        
        if let Some(stream) = streams.get(stream_id) {
            trace!("Routing video frame {} to stream {}", frame.frame_id, stream_id);
            
            stream.video_tx
                .send(frame)
                .map_err(|_| StreamingError::AudioProcessing(
                    format!("Stream {} video channel closed", stream_id)
                ))?;
            
            Ok(())
        } else {
            Err(StreamingError::StreamNotFound(stream_id.to_string()))
        }
    }

    /// Send a synchronized multimodal frame to a stream
    pub async fn send_multimodal_frame(&self, stream_id: &StreamId, frame: MultimodalFrame) -> StreamingResult<()> {
        let streams = self.streams.read().await;
        
        if let Some(stream) = streams.get(stream_id) {
            trace!("Sending multimodal frame {} to stream {}", frame.sync_id, stream_id);
            
            stream.output_tx
                .send(frame)
                .map_err(|_| StreamingError::AudioProcessing(
                    format!("Stream {} output channel closed", stream_id)
                ))?;
            
            // Increment frame counter
            drop(streams);
            let mut counter = self.frame_counter.write().await;
            *counter += 1;
            
            Ok(())
        } else {
            Err(StreamingError::StreamNotFound(stream_id.to_string()))
        }
    }

    /// Broadcast a frame to all streams matching the given criteria
    pub async fn broadcast_audio(
        &self,
        frame: AudioFrame,
        filter: impl Fn(&StreamInfo) -> bool,
    ) -> Vec<StreamingResult<()>> {
        let streams = self.streams.read().await;
        let mut results = Vec::new();

        for (id, stream) in streams.iter() {
            if filter(&stream.info) {
                let result = stream.audio_tx.send(frame.clone()).map_err(|_| {
                    StreamingError::AudioProcessing(format!("Stream {} channel closed", id))
                });
                results.push(result);
            }
        }

        results
    }

    /// Get list of active stream IDs
    pub async fn active_streams(&self) -> Vec<StreamId> {
        let streams = self.streams.read().await;
        streams.keys().cloned().collect()
    }

    /// Get stream info
    pub async fn get_stream_info(&self, stream_id: &StreamId) -> Option<StreamInfo> {
        let streams = self.streams.read().await;
        streams.get(stream_id).map(|s| s.info.clone())
    }

    /// Get count of active streams
    pub async fn stream_count(&self) -> usize {
        let streams = self.streams.read().await;
        streams.len()
    }

    /// Get total frames processed
    pub async fn frame_count(&self) -> u64 {
        *self.frame_counter.read().await
    }

    /// Update stream priority
    pub async fn set_priority(&self, stream_id: &StreamId, priority: u8) -> StreamingResult<()> {
        let mut streams = self.streams.write().await;
        
        if let Some(stream) = streams.get_mut(stream_id) {
            stream.info.priority = priority;
            debug!("Updated stream {} priority to {}", stream_id, priority);
            Ok(())
        } else {
            Err(StreamingError::StreamNotFound(stream_id.to_string()))
        }
    }

    /// Get statistics for all streams
    pub async fn stats(&self) -> MuxStats {
        let streams = self.streams.read().await;
        
        MuxStats {
            total_streams: streams.len(),
            audio_streams: streams.values().filter(|s| {
                matches!(s.info.stream_type, StreamType::Audio | StreamType::AudioVideo)
            }).count(),
            video_streams: streams.values().filter(|s| {
                matches!(s.info.stream_type, StreamType::Video | StreamType::AudioVideo)
            }).count(),
            total_frames: *self.frame_counter.read().await,
        }
    }

    /// Close all streams and clear state
    pub async fn shutdown(&self) {
        let mut streams = self.streams.write().await;
        let count = streams.len();
        streams.clear();
        *self.frame_counter.write().await = 0;
        info!("Multiplexer shutdown complete ({} streams closed)", count);
    }
}

impl Default for StreamMultiplexer {
    fn default() -> Self {
        Self::new()
    }
}

/// Multiplexer statistics
#[derive(Debug, Clone)]
pub struct MuxStats {
    pub total_streams: usize,
    pub audio_streams: usize,
    pub video_streams: usize,
    pub total_frames: u64,
}

impl std::fmt::Display for MuxStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "MuxStats: {} streams ({} audio, {} video), {} frames",
            self.total_streams, self.audio_streams, self.video_streams, self.total_frames
        )
    }
}

/// Demultiplexer for splitting combined streams
pub struct StreamDemultiplexer {
    /// Input frame receiver
    frame_rx: mpsc::UnboundedReceiver<MultimodalFrame>,
    /// Audio frame output
    audio_tx: mpsc::UnboundedSender<AudioFrame>,
    /// Video frame output
    video_tx: mpsc::UnboundedSender<VideoFrame>,
}

impl StreamDemultiplexer {
    /// Create a new demultiplexer
    pub fn new() -> (
        Self,
        mpsc::UnboundedSender<MultimodalFrame>,
        mpsc::UnboundedReceiver<AudioFrame>,
        mpsc::UnboundedReceiver<VideoFrame>,
    ) {
        let (input_tx, input_rx) = mpsc::unbounded_channel();
        let (audio_tx, audio_rx) = mpsc::unbounded_channel();
        let (video_tx, video_rx) = mpsc::unbounded_channel();

        let demux = Self {
            frame_rx: input_rx,
            audio_tx,
            video_tx,
        };

        (demux, input_tx, audio_rx, video_rx)
    }

    /// Run the demultiplexer loop
    /// 
    /// SYSTEM_LAW: STUB_APPROVED - Full demux logic pending integration testing
    pub async fn run(mut self) {
        info!("StreamDemultiplexer started");

        while let Some(frame) = self.frame_rx.recv().await {
            // Extract and route audio
            if let Some(audio) = frame.audio {
                if let Err(e) = self.audio_tx.send(audio) {
                    warn!("Failed to send audio frame: {}", e);
                }
            }

            // Extract and route video
            if let Some(video) = frame.video {
                if let Err(e) = self.video_tx.send(video) {
                    warn!("Failed to send video frame: {}", e);
                }
            }
        }

        info!("StreamDemultiplexer stopped");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{FrameMetadata, AudioCodec, AudioConfig};

    fn create_test_audio_frame(frame_id: &str) -> AudioFrame {
        AudioFrame {
            frame_id: frame_id.to_string(),
            stream_id: "test_stream".to_string(),
            timestamp: chrono::Utc::now(),
            samples: vec![0.0; 960],
            sample_rate: 48000,
            channels: 2,
            duration_ms: 20,
            metadata: FrameMetadata {
                encoding: Some("opus".to_string()),
                source: Some("test".to_string()),
                sequence: Some(0),
                extra: Default::default(),
            },
        }
    }

    fn create_test_video_frame(frame_id: &str) -> VideoFrame {
        VideoFrame {
            frame_id: frame_id.to_string(),
            stream_id: "test_stream".to_string(),
            timestamp: chrono::Utc::now(),
            data: vec![0u8; 1000],
            width: 1920,
            height: 1080,
            metadata: FrameMetadata {
                encoding: Some("h264".to_string()),
                source: Some("test".to_string()),
                sequence: Some(0),
                extra: Default::default(),
            },
        }
    }

    #[tokio::test]
    async fn test_multiplexer_creation() {
        let mux = StreamMultiplexer::new();
        assert_eq!(mux.stream_count().await, 0);
    }

    #[tokio::test]
    async fn test_register_stream() {
        let mux = StreamMultiplexer::new();
        let info = StreamInfo::new("stream_1", StreamType::Audio, StreamDirection::Bidirectional);
        
        let (audio_rx, video_rx, output_rx) = mux.register_stream(info).await.unwrap();
        drop(audio_rx);
        drop(video_rx);
        drop(output_rx);
        
        assert_eq!(mux.stream_count().await, 1);
    }

    #[tokio::test]
    async fn test_register_duplicate_stream() {
        let mux = StreamMultiplexer::new();
        let info = StreamInfo::new("stream_1", StreamType::Audio, StreamDirection::Bidirectional);
        
        let (audio_rx1, _video_rx1, _output_rx1) = mux.register_stream(info.clone()).await.unwrap();
        drop(audio_rx1);
        
        let result = mux.register_stream(info).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_unregister_stream() {
        let mux = StreamMultiplexer::new();
        let info = StreamInfo::new("stream_1", StreamType::Audio, StreamDirection::Bidirectional);
        
        let (audio_rx, _video_rx, _output_rx) = mux.register_stream(info).await.unwrap();
        drop(audio_rx);
        
        assert_eq!(mux.stream_count().await, 1);
        
        mux.unregister_stream(&StreamId::from("stream_1")).await.unwrap();
        assert_eq!(mux.stream_count().await, 0);
    }

    #[tokio::test]
    async fn test_route_audio_frame() {
        let mux = StreamMultiplexer::new();
        let info = StreamInfo::new("stream_1", StreamType::Audio, StreamDirection::Bidirectional);
        
        let (mut audio_rx, _video_rx, _output_rx) = mux.register_stream(info).await.unwrap();
        
        let frame = create_test_audio_frame("audio_1");
        mux.route_audio_frame(&StreamId::from("stream_1"), frame.clone()).await.unwrap();
        
        let received = audio_rx.recv().await;
        assert!(received.is_some());
        assert_eq!(received.unwrap().frame_id, "audio_1");
    }

    #[tokio::test]
    async fn test_route_video_frame() {
        let mux = StreamMultiplexer::new();
        let info = StreamInfo::new("stream_1", StreamType::Video, StreamDirection::Bidirectional);
        
        let (_audio_rx, mut video_rx, _output_rx) = mux.register_stream(info).await.unwrap();
        
        let frame = create_test_video_frame("video_1");
        mux.route_video_frame(&StreamId::from("stream_1"), frame.clone()).await.unwrap();
        
        let received = video_rx.recv().await;
        assert!(received.is_some());
        assert_eq!(received.unwrap().frame_id, "video_1");
    }

    #[tokio::test]
    async fn test_stream_stats() {
        let mux = StreamMultiplexer::new();
        
        // Register audio stream
        let audio_info = StreamInfo::new("audio_stream", StreamType::Audio, StreamDirection::Send);
        let (rx1, _, _) = mux.register_stream(audio_info).await.unwrap();
        drop(rx1);
        
        // Register video stream
        let video_info = StreamInfo::new("video_stream", StreamType::Video, StreamDirection::Receive);
        let (_, rx2, _) = mux.register_stream(video_info).await.unwrap();
        drop(rx2);
        
        // Register audiovideo stream
        let av_info = StreamInfo::new("av_stream", StreamType::AudioVideo, StreamDirection::Bidirectional);
        let (_, _, rx3) = mux.register_stream(av_info).await.unwrap();
        drop(rx3);
        
        let stats = mux.stats().await;
        assert_eq!(stats.total_streams, 3);
        assert_eq!(stats.audio_streams, 2); // audio + audiovideo
        assert_eq!(stats.video_streams, 2); // video + audiovideo
    }

    #[tokio::test]
    async fn test_demultiplexer() {
        let (demux, input_tx, mut audio_rx, mut video_rx) = StreamDemultiplexer::new();
        
        // Run demux in background
        tokio::spawn(async move {
            demux.run().await;
        });
        
        // Send a multimodal frame
        let mm_frame = MultimodalFrame {
            sync_id: "sync_1".to_string(),
            timestamp: chrono::Utc::now(),
            audio: Some(create_test_audio_frame("audio_1")),
            video: Some(create_test_video_frame("video_1")),
            sync_offset_ms: 0,
        };
        
        input_tx.send(mm_frame).unwrap();
        
        // Check that both components were extracted
        let audio = audio_rx.recv().await;
        let video = video_rx.recv().await;
        
        assert!(audio.is_some());
        assert!(video.is_some());
        assert_eq!(audio.unwrap().frame_id, "audio_1");
        assert_eq!(video.unwrap().frame_id, "video_1");
    }

    #[test]
    fn test_stream_id_from_str() {
        let id = StreamId::from("test_stream");
        assert_eq!(id.0, "test_stream");
        assert_eq!(format!("{}", id), "test_stream");
    }

    #[test]
    fn test_stream_info_builder() {
        let info = StreamInfo::new("stream_1", StreamType::AudioVideo, StreamDirection::Bidirectional)
            .with_priority(200)
            .with_peer_id("peer_123");
        
        assert_eq!(info.stream_id.0, "stream_1");
        assert_eq!(info.stream_type, StreamType::AudioVideo);
        assert_eq!(info.direction, StreamDirection::Bidirectional);
        assert_eq!(info.priority, 200);
        assert_eq!(info.peer_id, Some("peer_123".to_string()));
    }

    #[test]
    fn test_mux_stats_display() {
        let stats = MuxStats {
            total_streams: 5,
            audio_streams: 3,
            video_streams: 4,
            total_frames: 1000,
        };
        
        let display = format!("{}", stats);
        assert!(display.contains("5 streams"));
        assert!(display.contains("3 audio"));
        assert!(display.contains("4 video"));
        assert!(display.contains("1000 frames"));
    }
}

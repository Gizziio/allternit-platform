//! Video Decoder
//!
//! GAP-38: Video decoder implementation for H.264, VP8, and VP9
//! WIH: GAP-38, Owner: T2-A2, Dependencies: types.rs, Deadline
//!
//! Implements video decoding with STUB_APPROVED for codecs not yet fully implemented.

use crate::types::{FrameMetadata, StreamingError, StreamingResult, VideoFrame};
use chrono::Utc;

/// Video codec types supported
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoCodec {
    /// H.264 / AVC codec
    H264,
    /// VP8 codec (WebRTC compatible)
    VP8,
    /// VP9 codec (next-gen WebRTC)
    VP9,
    /// AV1 codec (future support)
    AV1,
    /// Raw YUV420P format
    Yuv420P,
    /// Raw RGB24 format
    Rgb24,
}

impl VideoCodec {
    /// Get the MIME type for this codec
    pub fn mime_type(&self) -> &'static str {
        match self {
            VideoCodec::H264 => "video/h264",
            VideoCodec::VP8 => "video/vp8",
            VideoCodec::VP9 => "video/vp9",
            VideoCodec::AV1 => "video/av1",
            VideoCodec::Yuv420P => "video/raw",
            VideoCodec::Rgb24 => "video/raw",
        }
    }

    /// Get codec name string
    pub fn as_str(&self) -> &'static str {
        match self {
            VideoCodec::H264 => "h264",
            VideoCodec::VP8 => "vp8",
            VideoCodec::VP9 => "vp9",
            VideoCodec::AV1 => "av1",
            VideoCodec::Yuv420P => "yuv420p",
            VideoCodec::Rgb24 => "rgb24",
        }
    }
}

impl std::fmt::Display for VideoCodec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Video stream configuration
#[derive(Debug, Clone)]
pub struct VideoConfig {
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
    /// Frame rate (frames per second)
    pub fps: f32,
    /// Video codec
    pub codec: VideoCodec,
    /// Bitrate in bits per second
    pub bitrate: Option<u32>,
    /// Buffer size in frames
    pub buffer_frames: usize,
}

impl Default for VideoConfig {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 720,
            fps: 30.0,
            codec: VideoCodec::VP8,
            bitrate: Some(2000000), // 2 Mbps
            buffer_frames: 3,
        }
    }
}

/// Video decoder supporting multiple codecs
///
/// SYSTEM_LAW COMPLIANCE: Uses STUB_APPROVED for video codecs not yet implemented.
pub struct VideoDecoder {
    /// Current configuration
    config: VideoConfig,
    /// Decoder state
    state: DecoderState,
    /// Frame counter for sequence numbers
    frame_count: u64,
    /// Codec-specific decoder context (stub for future implementation)
    codec_context: Option<Box<dyn CodecContext>>,
}

/// Decoder state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecoderState {
    /// Initializing
    Initializing,
    /// Ready to decode
    Ready,
    /// Decoding in progress
    Decoding,
    /// Error state
    Error,
    /// Closed
    Closed,
}

/// Trait for codec-specific context (stub for future implementations)
trait CodecContext: Send + Sync {
    fn decode_frame(&mut self, data: &[u8]) -> StreamingResult<DecodedFrame>;
    fn reset(&mut self);
}

/// Decoded frame data before conversion to VideoFrame
#[derive(Debug, Clone)]
struct DecodedFrame {
    /// Raw pixel data
    data: Vec<u8>,
    /// Width
    width: u32,
    /// Height
    height: u32,
    /// Pixel format
    format: PixelFormat,
}

/// Pixel format for decoded frames
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PixelFormat {
    /// YUV 4:2:0 planar
    Yuv420P,
    /// YUV 4:2:2 planar
    Yuv422P,
    /// RGB 24-bit
    Rgb24,
    /// RGBA 32-bit
    Rgba32,
    /// BGRA 32-bit
    Bgra32,
}

impl std::fmt::Display for PixelFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PixelFormat::Yuv420P => write!(f, "yuv420p"),
            PixelFormat::Yuv422P => write!(f, "yuv422p"),
            PixelFormat::Rgb24 => write!(f, "rgb24"),
            PixelFormat::Rgba32 => write!(f, "rgba32"),
            PixelFormat::Bgra32 => write!(f, "bgra32"),
        }
    }
}

impl VideoDecoder {
    /// Create a new video decoder with the given configuration
    pub fn new(config: &VideoConfig) -> Self {
        let codec_context = Self::create_codec_context(config.codec);

        Self {
            config: config.clone(),
            state: DecoderState::Ready,
            frame_count: 0,
            codec_context,
        }
    }

    /// Create codec-specific context
    fn create_codec_context(codec: VideoCodec) -> Option<Box<dyn CodecContext>> {
        match codec {
            // STUB_APPROVED: Real codec implementations will be added in future iterations
            // For now, we use stub implementations that return placeholder data
            VideoCodec::H264 => Some(Box::new(H264DecoderStub::new())),
            VideoCodec::VP8 => Some(Box::new(VP8DecoderStub::new())),
            VideoCodec::VP9 => Some(Box::new(VP9DecoderStub::new())),
            VideoCodec::AV1 => Some(Box::new(AV1DecoderStub::new())),
            // Raw formats don't need decoding
            VideoCodec::Yuv420P | VideoCodec::Rgb24 => None,
        }
    }

    /// Get current decoder state
    pub fn state(&self) -> DecoderState {
        self.state
    }

    /// Get current configuration
    pub fn config(&self) -> &VideoConfig {
        &self.config
    }

    /// Update configuration (requires reinitializing decoder)
    pub fn reconfigure(&mut self, config: VideoConfig) {
        self.config = config.clone();
        self.codec_context = Self::create_codec_context(config.codec);
        self.frame_count = 0;
        self.state = DecoderState::Ready;
    }

    /// Decode encoded video data into raw frame data
    ///
    /// # Arguments
    /// * `encoded_data` - Encoded video bytes
    /// * `timestamp` - Frame timestamp
    /// * `stream_id` - Stream identifier
    ///
    /// # Returns
    /// * `Ok(VideoFrame)` - Decoded video frame
    /// * `Err(StreamingError)` - Decoding failed
    ///
    /// # SYSTEM_LAW COMPLIANCE
    /// Uses STUB_APPROVED for video codecs not yet fully implemented.
    pub fn decode(
        &mut self,
        encoded_data: &[u8],
        timestamp: chrono::DateTime<Utc>,
        stream_id: &str,
    ) -> StreamingResult<VideoFrame> {
        if self.state == DecoderState::Closed {
            return Err(StreamingError::Codec(
                "Decoder is closed".to_string()
            ));
        }

        if self.state == DecoderState::Error {
            return Err(StreamingError::Codec(
                "Decoder is in error state".to_string()
            ));
        }

        self.state = DecoderState::Decoding;
        self.frame_count += 1;

        // Handle raw formats (no decoding needed)
        match self.config.codec {
            VideoCodec::Yuv420P => {
                return self.create_frame_from_raw(encoded_data, timestamp, stream_id, PixelFormat::Yuv420P);
            }
            VideoCodec::Rgb24 => {
                return self.create_frame_from_raw(encoded_data, timestamp, stream_id, PixelFormat::Rgb24);
            }
            _ => {}
        }

        // Use codec-specific decoder (STUB_APPROVED implementation)
        let decoded = if let Some(ref mut ctx) = self.codec_context {
            ctx.decode_frame(encoded_data)?
        } else {
            return Err(StreamingError::Codec(
                format!("No decoder available for codec: {:?}", self.config.codec)
            ));
        };

        // Create VideoFrame from decoded data
        let frame = VideoFrame {
            frame_id: format!("{}_frame_{}", stream_id, self.frame_count),
            stream_id: stream_id.to_string(),
            timestamp,
            data: decoded.data,
            width: decoded.width,
            height: decoded.height,
            metadata: FrameMetadata {
                encoding: Some(self.config.codec.to_string()),
                source: Some("webrtc".to_string()),
                sequence: Some(self.frame_count),
                extra: {
                    let mut extra = std::collections::HashMap::new();
                    extra.insert("pixel_format".to_string(), format!("{:?}", decoded.format));
                    extra.insert("fps".to_string(), self.config.fps.to_string());
                    extra
                },
            },
        };

        self.state = DecoderState::Ready;
        Ok(frame)
    }

    /// Create frame from raw pixel data (no decoding)
    fn create_frame_from_raw(
        &self,
        data: &[u8],
        timestamp: chrono::DateTime<Utc>,
        stream_id: &str,
        format: PixelFormat,
    ) -> StreamingResult<VideoFrame> {
        // Validate data size
        let expected_size = match format {
            PixelFormat::Yuv420P => (self.config.width * self.config.height * 3 / 2) as usize,
            PixelFormat::Rgb24 => (self.config.width * self.config.height * 3) as usize,
            _ => data.len(),
        };

        if data.len() != expected_size {
            return Err(StreamingError::InvalidFrameFormat(format!(
                "Raw data size mismatch: expected {}, got {}",
                expected_size,
                data.len()
            )));
        }

        Ok(VideoFrame {
            frame_id: format!("{}_frame_{}", stream_id, self.frame_count),
            stream_id: stream_id.to_string(),
            timestamp,
            data: data.to_vec(),
            width: self.config.width,
            height: self.config.height,
            metadata: FrameMetadata {
                encoding: Some(format.to_string()),
                source: Some("webrtc".to_string()),
                sequence: Some(self.frame_count),
                extra: Default::default(),
            },
        })
    }

    /// Reset the decoder state
    pub fn reset(&mut self) {
        self.frame_count = 0;
        self.state = DecoderState::Ready;
        if let Some(ref mut ctx) = self.codec_context {
            ctx.reset();
        }
    }

    /// Close the decoder
    pub fn close(&mut self) {
        self.state = DecoderState::Closed;
        self.codec_context = None;
    }

    /// Get total frames decoded
    pub fn frames_decoded(&self) -> u64 {
        self.frame_count
    }
}

// ============================================================================
// STUB_APPROVED Codec Implementations
// These are placeholder implementations that will be replaced with actual
// codec libraries in future iterations.
// ============================================================================

/// H.264 decoder stub (STUB_APPROVED)
struct H264DecoderStub;

impl H264DecoderStub {
    fn new() -> Self {
        Self
    }
}

impl CodecContext for H264DecoderStub {
    fn decode_frame(&mut self, _data: &[u8]) -> StreamingResult<DecodedFrame> {
        // STUB_APPROVED: Placeholder implementation
        // In production, this would use a real H.264 decoder like openh264 or ffmpeg
        Ok(DecodedFrame {
            data: vec![0u8; 1280 * 720 * 3], // Placeholder: RGB data
            width: 1280,
            height: 720,
            format: PixelFormat::Rgb24,
        })
    }

    fn reset(&mut self) {
        // STUB_APPROVED: Nothing to reset in stub
    }
}

/// VP8 decoder stub (STUB_APPROVED)
struct VP8DecoderStub;

impl VP8DecoderStub {
    fn new() -> Self {
        Self
    }
}

impl CodecContext for VP8DecoderStub {
    fn decode_frame(&mut self, _data: &[u8]) -> StreamingResult<DecodedFrame> {
        // STUB_APPROVED: Placeholder implementation
        // In production, this would use libvpx
        Ok(DecodedFrame {
            data: vec![0u8; 1280 * 720 * 3], // Placeholder: RGB data
            width: 1280,
            height: 720,
            format: PixelFormat::Rgb24,
        })
    }

    fn reset(&mut self) {
        // STUB_APPROVED: Nothing to reset in stub
    }
}

/// VP9 decoder stub (STUB_APPROVED)
struct VP9DecoderStub;

impl VP9DecoderStub {
    fn new() -> Self {
        Self
    }
}

impl CodecContext for VP9DecoderStub {
    fn decode_frame(&mut self, _data: &[u8]) -> StreamingResult<DecodedFrame> {
        // STUB_APPROVED: Placeholder implementation
        // In production, this would use libvpx
        Ok(DecodedFrame {
            data: vec![0u8; 1280 * 720 * 3], // Placeholder: RGB data
            width: 1280,
            height: 720,
            format: PixelFormat::Rgb24,
        })
    }

    fn reset(&mut self) {
        // STUB_APPROVED: Nothing to reset in stub
    }
}

/// AV1 decoder stub (STUB_APPROVED)
struct AV1DecoderStub;

impl AV1DecoderStub {
    fn new() -> Self {
        Self
    }
}

impl CodecContext for AV1DecoderStub {
    fn decode_frame(&mut self, _data: &[u8]) -> StreamingResult<DecodedFrame> {
        // STUB_APPROVED: Placeholder implementation
        // In production, this would use dav1d or libaom
        Ok(DecodedFrame {
            data: vec![0u8; 1280 * 720 * 3], // Placeholder: RGB data
            width: 1280,
            height: 720,
            format: PixelFormat::Rgb24,
        })
    }

    fn reset(&mut self) {
        // STUB_APPROVED: Nothing to reset in stub
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

    #[test]
    fn test_video_codec_mime_types() {
        assert_eq!(VideoCodec::H264.mime_type(), "video/h264");
        assert_eq!(VideoCodec::VP8.mime_type(), "video/vp8");
        assert_eq!(VideoCodec::VP9.mime_type(), "video/vp9");
        assert_eq!(VideoCodec::AV1.mime_type(), "video/av1");
    }

    #[test]
    fn test_video_codec_strings() {
        assert_eq!(VideoCodec::H264.as_str(), "h264");
        assert_eq!(VideoCodec::VP8.as_str(), "vp8");
        assert_eq!(VideoCodec::VP9.as_str(), "vp9");
        assert_eq!(VideoCodec::Yuv420P.as_str(), "yuv420p");
    }

    #[test]
    fn test_video_config_default() {
        let config = VideoConfig::default();
        assert_eq!(config.width, 1280);
        assert_eq!(config.height, 720);
        assert_eq!(config.fps, 30.0);
        assert_eq!(config.codec, VideoCodec::VP8);
        assert_eq!(config.bitrate, Some(2000000));
    }

    #[test]
    fn test_decoder_creation() {
        let config = create_test_config();
        let decoder = VideoDecoder::new(&config);
        
        assert_eq!(decoder.state(), DecoderState::Ready);
        assert_eq!(decoder.config().codec, VideoCodec::VP8);
    }

    #[test]
    fn test_decoder_state_transitions() {
        let config = create_test_config();
        let mut decoder = VideoDecoder::new(&config);
        
        assert_eq!(decoder.state(), DecoderState::Ready);
        
        // Decode a frame (STUB_APPROVED will succeed)
        let test_data = vec![0u8; 100];
        let result = decoder.decode(&test_data, Utc::now(), "test_stream");
        assert!(result.is_ok());
        assert_eq!(decoder.state(), DecoderState::Ready);
        
        // Close decoder
        decoder.close();
        assert_eq!(decoder.state(), DecoderState::Closed);
        
        // Should fail after close
        let result = decoder.decode(&test_data, Utc::now(), "test_stream");
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_vp8() {
        let config = VideoConfig {
            codec: VideoCodec::VP8,
            ..create_test_config()
        };
        let mut decoder = VideoDecoder::new(&config);
        
        let test_data = vec![0u8; 100];
        let frame = decoder.decode(&test_data, Utc::now(), "test_stream").unwrap();
        
        assert_eq!(frame.width, 1280); // Stub returns 1280x720
        assert_eq!(frame.height, 720);
        assert_eq!(frame.stream_id, "test_stream");
        assert!(frame.frame_id.contains("test_stream"));
    }

    #[test]
    fn test_decode_h264() {
        let config = VideoConfig {
            codec: VideoCodec::H264,
            ..create_test_config()
        };
        let mut decoder = VideoDecoder::new(&config);
        
        let test_data = vec![0u8; 100];
        let frame = decoder.decode(&test_data, Utc::now(), "test_stream").unwrap();
        
        assert!(frame.metadata.encoding.as_ref().unwrap().contains("h264"));
    }

    #[test]
    fn test_decode_vp9() {
        let config = VideoConfig {
            codec: VideoCodec::VP9,
            ..create_test_config()
        };
        let mut decoder = VideoDecoder::new(&config);
        
        let test_data = vec![0u8; 100];
        let frame = decoder.decode(&test_data, Utc::now(), "test_stream").unwrap();
        
        assert!(frame.metadata.encoding.as_ref().unwrap().contains("vp9"));
    }

    #[test]
    fn test_decode_yuv420p() {
        let config = VideoConfig {
            width: 640,
            height: 480,
            codec: VideoCodec::Yuv420P,
            ..create_test_config()
        };
        let mut decoder = VideoDecoder::new(&config);
        
        // YUV420P requires width * height * 1.5 bytes
        let expected_size = (640 * 480 * 3 / 2) as usize;
        let test_data = vec![128u8; expected_size];
        let frame = decoder.decode(&test_data, Utc::now(), "test_stream").unwrap();
        
        assert_eq!(frame.width, 640);
        assert_eq!(frame.height, 480);
    }

    #[test]
    fn test_decode_yuv420p_wrong_size() {
        let config = VideoConfig {
            width: 640,
            height: 480,
            codec: VideoCodec::Yuv420P,
            ..create_test_config()
        };
        let mut decoder = VideoDecoder::new(&config);
        
        // Wrong size should fail
        let test_data = vec![128u8; 100];
        let result = decoder.decode(&test_data, Utc::now(), "test_stream");
        
        assert!(result.is_err());
    }

    #[test]
    fn test_decoder_reset() {
        let config = create_test_config();
        let mut decoder = VideoDecoder::new(&config);
        
        // Decode some frames
        let test_data = vec![0u8; 100];
        for _ in 0..5 {
            decoder.decode(&test_data, Utc::now(), "test_stream").unwrap();
        }
        
        assert_eq!(decoder.frames_decoded(), 5);
        
        // Reset
        decoder.reset();
        assert_eq!(decoder.frames_decoded(), 0);
        assert_eq!(decoder.state(), DecoderState::Ready);
    }

    #[test]
    fn test_reconfigure() {
        let config = create_test_config();
        let mut decoder = VideoDecoder::new(&config);
        
        let new_config = VideoConfig {
            width: 1920,
            height: 1080,
            fps: 60.0,
            codec: VideoCodec::H264,
            bitrate: Some(5000000),
            buffer_frames: 5,
        };
        
        decoder.reconfigure(new_config.clone());
        
        assert_eq!(decoder.config().width, 1920);
        assert_eq!(decoder.config().height, 1080);
        assert_eq!(decoder.config().codec, VideoCodec::H264);
    }
}

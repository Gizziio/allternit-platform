//! Video Frame Buffer
//!
//! GAP-38: Video frame buffering for jitter handling and frame extraction
//! WIH: GAP-38, Owner: T2-A2, Dependencies: types.rs, Deadline
//!
//! Implements video stream buffering with frame extraction capabilities.

use crate::types::{StreamingError, StreamingResult, VideoFrame};
use std::collections::VecDeque;

/// Video buffer configuration
#[derive(Debug, Clone)]
pub struct VideoBufferConfig {
    /// Maximum number of frames to buffer
    pub max_frames: usize,
    /// Target buffer depth in frames (for jitter handling)
    pub target_depth: usize,
    /// Maximum frame age in milliseconds before dropping
    pub max_frame_age_ms: u64,
    /// Enable frame dropping on overflow
    pub drop_on_overflow: bool,
}

impl Default for VideoBufferConfig {
    fn default() -> Self {
        Self {
            max_frames: 30,        // 1 second at 30fps
            target_depth: 3,       // 3 frames target
            max_frame_age_ms: 500, // 500ms max age
            drop_on_overflow: true,
        }
    }
}

/// Video frame buffer for jitter handling and frame extraction
///
/// This buffer manages incoming video frames, handles jitter,
/// and provides frame extraction for display/processing.
pub struct VideoBuffer {
    /// Buffer configuration
    config: VideoBufferConfig,
    /// Frame storage (ordered by sequence/timestamp)
    frames: VecDeque<BufferedFrame>,
    /// Current buffer occupancy
    occupancy: usize,
    /// Total frames received
    frames_received: u64,
    /// Total frames dropped
    frames_dropped: u64,
    /// Total frames extracted
    frames_extracted: u64,
    /// Last extracted frame sequence
    last_sequence: Option<u64>,
    /// Target width (for scaling)
    target_width: u32,
    /// Target height (for scaling)
    target_height: u32,
}

/// Internal frame wrapper with metadata
#[derive(Debug, Clone)]
struct BufferedFrame {
    /// The video frame
    frame: VideoFrame,
    /// Buffer insertion timestamp
    inserted_at: std::time::Instant,
    /// Frame priority (for quality of service)
    priority: FramePriority,
}

/// Frame priority for QoS handling
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FramePriority {
    /// Critical frame (e.g., keyframe)
    Critical = 3,
    /// High priority
    High = 2,
    /// Normal priority
    Normal = 1,
    /// Low priority (can be dropped)
    Low = 0,
}

/// Frame extraction options
#[derive(Debug, Clone)]
pub struct ExtractionOptions {
    /// Target width (None = original)
    pub target_width: Option<u32>,
    /// Target height (None = original)
    pub target_height: Option<u32>,
    /// Pixel format to convert to
    pub target_format: Option<PixelFormat>,
    /// Quality preset (for compression)
    pub quality: QualityPreset,
}

impl Default for ExtractionOptions {
    fn default() -> Self {
        Self {
            target_width: None,
            target_height: None,
            target_format: None,
            quality: QualityPreset::High,
        }
    }
}

/// Quality preset for frame extraction
#[derive(Debug, Clone, Copy)]
pub enum QualityPreset {
    /// Low quality (fast)
    Low,
    /// Medium quality
    Medium,
    /// High quality
    High,
    /// Lossless quality (slow)
    Lossless,
}

/// Pixel format for frame conversion
#[derive(Debug, Clone, Copy)]
pub enum PixelFormat {
    /// RGB24 format
    Rgb24,
    /// RGBA32 format
    Rgba32,
    /// YUV420P format
    Yuv420P,
    /// NV12 format
    Nv12,
}

/// Buffer statistics
#[derive(Debug, Clone)]
pub struct BufferStats {
    pub occupancy: usize,
    pub max_frames: usize,
    pub target_depth: usize,
    pub frames_received: u64,
    pub frames_dropped: u64,
    pub frames_extracted: u64,
    pub drop_rate: f64,
}

impl VideoBuffer {
    /// Create a new video buffer with default configuration
    pub fn new() -> Self {
        Self::with_config(VideoBufferConfig::default())
    }

    /// Create a new video buffer with specific configuration
    pub fn with_config(config: VideoBufferConfig) -> Self {
        Self {
            config,
            frames: VecDeque::with_capacity(30),
            occupancy: 0,
            frames_received: 0,
            frames_dropped: 0,
            frames_extracted: 0,
            last_sequence: None,
            target_width: 0,
            target_height: 0,
        }
    }

    /// Create a new video buffer with target dimensions
    pub fn with_dimensions(width: u32, height: u32) -> Self {
        let mut buffer = Self::new();
        buffer.target_width = width;
        buffer.target_height = height;
        buffer
    }

    /// Push a frame into the buffer
    ///
    /// Returns true if frame was accepted, false if dropped
    pub fn push(&mut self, frame: VideoFrame) -> bool {
        self.frames_received += 1;

        // Check if buffer is full
        if self.frames.len() >= self.config.max_frames {
            if self.config.drop_on_overflow {
                // Drop oldest low-priority frame or this frame
                self.drop_oldest_if_possible();
                
                if self.frames.len() >= self.config.max_frames {
                    self.frames_dropped += 1;
                    return false;
                }
            } else {
                self.frames_dropped += 1;
                return false;
            }
        }

        // Determine frame priority
        let priority = self.determine_priority(&frame);

        // Create buffered frame
        let buffered = BufferedFrame {
            frame,
            inserted_at: std::time::Instant::now(),
            priority,
        };

        // Insert maintaining order (by sequence number if available)
        self.insert_ordered(buffered);
        self.occupancy = self.frames.len();

        true
    }

    /// Insert frame in order based on sequence number
    fn insert_ordered(&mut self, new_frame: BufferedFrame) {
        let new_seq = new_frame.frame.metadata.sequence;
        
        if let Some(new_seq) = new_seq {
            // Find insertion point
            let insert_idx = self.frames
                .iter()
                .position(|f| {
                    f.frame.metadata.sequence.map(|s| s > new_seq).unwrap_or(true)
                })
                .unwrap_or(self.frames.len());
            
            self.frames.insert(insert_idx, new_frame);
        } else {
            // No sequence number, append
            self.frames.push_back(new_frame);
        }
    }

    /// Determine frame priority based on metadata
    fn determine_priority(&self, frame: &VideoFrame) -> FramePriority {
        // Check if this looks like a keyframe
        if let Some(extra) = frame.metadata.extra.get("frame_type") {
            if extra == "keyframe" || extra == "IDR" {
                return FramePriority::Critical;
            }
        }

        // Check encoding hints
        if let Some(encoding) = &frame.metadata.encoding {
            if encoding.contains("key") || encoding.contains("idr") {
                return FramePriority::Critical;
            }
        }

        // Default priority based on buffer state
        if self.frames.len() < self.config.target_depth {
            FramePriority::High
        } else {
            FramePriority::Normal
        }
    }

    /// Drop oldest frame if it's low priority
    fn drop_oldest_if_possible(&mut self) {
        if let Some(oldest) = self.frames.front() {
            if oldest.priority <= FramePriority::Low {
                self.frames.pop_front();
                self.frames_dropped += 1;
            }
        }
    }

    /// Pop the next frame from the buffer (FIFO order)
    pub fn pop(&mut self) -> Option<VideoFrame> {
        // Clean old frames first
        self.clean_old_frames();

        // Check if we have enough buffered frames
        if self.frames.len() < self.config.target_depth {
            // Not enough frames yet (jitter buffer)
            return None;
        }

        self.frames.pop_front().map(|bf| {
            self.occupancy = self.frames.len();
            self.frames_extracted += 1;
            self.last_sequence = bf.frame.metadata.sequence;
            bf.frame
        })
    }

    /// Peek at the next frame without removing it
    pub fn peek(&self) -> Option<&VideoFrame> {
        self.frames.front().map(|bf| &bf.frame)
    }

    /// Extract a specific frame by sequence number
    pub fn extract_by_sequence(&mut self, sequence: u64) -> Option<VideoFrame> {
        if let Some(idx) = self.frames.iter().position(|bf| {
            bf.frame.metadata.sequence == Some(sequence)
        }) {
            let bf = self.frames.remove(idx).unwrap();
            self.occupancy = self.frames.len();
            self.frames_extracted += 1;
            return Some(bf.frame);
        }
        None
    }

    /// Extract a frame with options (format conversion, scaling)
    ///
    /// STUB_APPROVED: Format conversion is stubbed for now
    pub fn extract_with_options(
        &mut self,
        options: &ExtractionOptions,
    ) -> Option<VideoFrame> {
        let frame = self.pop()?;
        
        // STUB_APPROVED: Format conversion not yet implemented
        // In production, this would perform actual pixel format conversion
        // and scaling using libraries like ffmpeg or libyuv
        Some(self.apply_extraction_options(frame, options))
    }

    /// Apply extraction options to frame (STUB_APPROVED)
    fn apply_extraction_options(
        &self,
        mut frame: VideoFrame,
        options: &ExtractionOptions,
    ) -> VideoFrame {
        // STUB_APPROVED: Actual format conversion would happen here
        // For now, we just update metadata to indicate what conversion
        // would have been requested
        
        if let Some(width) = options.target_width {
            frame.metadata.extra.insert("target_width".to_string(), width.to_string());
        }
        
        if let Some(height) = options.target_height {
            frame.metadata.extra.insert("target_height".to_string(), height.to_string());
        }
        
        if let Some(format) = options.target_format {
            frame.metadata.extra.insert(
                "target_format".to_string(),
                format!("{:?}", format)
            );
        }
        
        frame.metadata.extra.insert(
            "quality".to_string(),
            format!("{:?}", options.quality)
        );

        frame
    }

    /// Get all frames in the buffer (drains the buffer)
    pub fn flush(&mut self) -> Vec<VideoFrame> {
        let frames: Vec<VideoFrame> = self.frames.drain(..).map(|bf| bf.frame).collect();
        self.occupancy = 0;
        frames
    }

    /// Clear all frames from the buffer
    pub fn clear(&mut self) {
        self.frames.clear();
        self.occupancy = 0;
    }

    /// Clean frames that are too old
    fn clean_old_frames(&mut self) {
        let now = std::time::Instant::now();
        let max_age = std::time::Duration::from_millis(self.config.max_frame_age_ms);

        while let Some(front) = self.frames.front() {
            if now.duration_since(front.inserted_at) > max_age {
                // Keep critical frames even if old
                if front.priority < FramePriority::Critical {
                    self.frames.pop_front();
                    self.frames_dropped += 1;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        self.occupancy = self.frames.len();
    }

    /// Get current buffer occupancy
    pub fn occupancy(&self) -> usize {
        self.occupancy
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.frames.is_empty()
    }

    /// Check if buffer is full
    pub fn is_full(&self) -> bool {
        self.frames.len() >= self.config.max_frames
    }

    /// Get buffer statistics
    pub fn stats(&self) -> BufferStats {
        let drop_rate = if self.frames_received > 0 {
            self.frames_dropped as f64 / self.frames_received as f64
        } else {
            0.0
        };

        BufferStats {
            occupancy: self.occupancy,
            max_frames: self.config.max_frames,
            target_depth: self.config.target_depth,
            frames_received: self.frames_received,
            frames_dropped: self.frames_dropped,
            frames_extracted: self.frames_extracted,
            drop_rate,
        }
    }

    /// Wait until target depth is reached
    pub fn is_ready(&self) -> bool {
        self.frames.len() >= self.config.target_depth
    }

    /// Get estimated jitter in milliseconds
    pub fn estimated_jitter_ms(&self) -> u64 {
        if self.frames.len() < 2 {
            return 0;
        }

        // Calculate average inter-frame interval variance
        // This is a simplified jitter estimation
        let mut intervals = Vec::new();
        let mut prev_time: Option<std::time::Instant> = None;

        for bf in self.frames.iter() {
            if let Some(prev) = prev_time {
                intervals.push(bf.inserted_at.duration_since(prev).as_millis() as u64);
            }
            prev_time = Some(bf.inserted_at);
        }

        if intervals.len() < 2 {
            return 0;
        }

        // Calculate standard deviation of intervals (simplified)
        let avg = intervals.iter().sum::<u64>() / intervals.len() as u64;
        let variance = intervals
            .iter()
            .map(|i| {
                let diff = if *i > avg { *i - avg } else { avg - *i };
                diff * diff
            })
            .sum::<u64>() / intervals.len() as u64;
        
        (variance as f64).sqrt() as u64
    }

    /// Set target dimensions for frame extraction
    pub fn set_target_dimensions(&mut self, width: u32, height: u32) {
        self.target_width = width;
        self.target_height = height;
    }

    /// Get target dimensions
    pub fn target_dimensions(&self) -> (u32, u32) {
        (self.target_width, self.target_height)
    }
}

impl Default for VideoBuffer {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for BufferStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "VideoBuffer: {}/{} frames, {} received, {} dropped ({:.1}% drop rate), {} extracted",
            self.occupancy,
            self.max_frames,
            self.frames_received,
            self.frames_dropped,
            self.drop_rate * 100.0,
            self.frames_extracted
        )
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FrameMetadata;
    use chrono::Utc;

    fn create_test_frame(frame_id: &str, sequence: u64) -> VideoFrame {
        VideoFrame {
            frame_id: frame_id.to_string(),
            stream_id: "test_stream".to_string(),
            timestamp: Utc::now(),
            data: vec![0u8; 100],
            width: 640,
            height: 480,
            metadata: FrameMetadata {
                encoding: Some("vp8".to_string()),
                source: Some("webrtc".to_string()),
                sequence: Some(sequence),
                extra: Default::default(),
            },
        }
    }

    fn create_keyframe(frame_id: &str, sequence: u64) -> VideoFrame {
        let mut frame = create_test_frame(frame_id, sequence);
        frame.metadata.extra.insert("frame_type".to_string(), "keyframe".to_string());
        frame
    }

    #[test]
    fn test_buffer_creation() {
        let buffer = VideoBuffer::new();
        assert!(buffer.is_empty());
        assert_eq!(buffer.occupancy(), 0);
    }

    #[test]
    fn test_buffer_push_pop() {
        let mut buffer = VideoBuffer::new();
        
        let frame = create_test_frame("frame1", 1);
        assert!(buffer.push(frame));
        assert_eq!(buffer.occupancy(), 1);
        
        let popped = buffer.pop();
        assert!(popped.is_some());
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_buffer_target_depth() {
        let mut config = VideoBufferConfig::default();
        config.target_depth = 3;
        let mut buffer = VideoBuffer::with_config(config);
        
        // Push frames
        for i in 0..5 {
            let frame = create_test_frame(&format!("frame{}", i), i);
            assert!(buffer.push(frame));
        }
        
        // Should not pop until target depth is reached
        // Actually, target depth affects when we start popping
        // Let's check - we have 5 frames, target is 3
        assert_eq!(buffer.occupancy(), 5);
        
        // Pop should work now that we have more than target_depth
        let popped = buffer.pop();
        assert!(popped.is_some());
    }

    #[test]
    fn test_buffer_ordering() {
        let mut buffer = VideoBuffer::new();
        
        // Push frames out of order
        buffer.push(create_test_frame("frame3", 3));
        buffer.push(create_test_frame("frame1", 1));
        buffer.push(create_test_frame("frame2", 2));
        
        // Should come out in order
        let f1 = buffer.pop().unwrap();
        let f2 = buffer.pop().unwrap();
        let f3 = buffer.pop().unwrap();
        
        assert_eq!(f1.metadata.sequence, Some(1));
        assert_eq!(f2.metadata.sequence, Some(2));
        assert_eq!(f3.metadata.sequence, Some(3));
    }

    #[test]
    fn test_buffer_overflow() {
        let mut config = VideoBufferConfig::default();
        config.max_frames = 3;
        config.drop_on_overflow = true;
        let mut buffer = VideoBuffer::with_config(config);
        
        // Fill buffer to capacity
        for i in 0..3 {
            assert!(buffer.push(create_test_frame(&format!("frame{}", i), i)));
        }
        
        assert!(buffer.is_full());
        
        // Next push should drop oldest non-critical frame
        let frame = create_test_frame("frame3", 3);
        assert!(buffer.push(frame));
        
        // Should still have 3 frames
        assert_eq!(buffer.occupancy(), 3);
    }

    #[test]
    fn test_extract_by_sequence() {
        let mut buffer = VideoBuffer::new();
        
        buffer.push(create_test_frame("frame1", 1));
        buffer.push(create_test_frame("frame2", 2));
        buffer.push(create_test_frame("frame3", 3));
        
        let extracted = buffer.extract_by_sequence(2);
        assert!(extracted.is_some());
        assert_eq!(extracted.unwrap().metadata.sequence, Some(2));
        
        // Should have 2 frames left
        assert_eq!(buffer.occupancy(), 2);
    }

    #[test]
    fn test_buffer_flush() {
        let mut buffer = VideoBuffer::new();
        
        for i in 0..5 {
            buffer.push(create_test_frame(&format!("frame{}", i), i));
        }
        
        let flushed = buffer.flush();
        assert_eq!(flushed.len(), 5);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_buffer_clear() {
        let mut buffer = VideoBuffer::new();
        
        for i in 0..5 {
            buffer.push(create_test_frame(&format!("frame{}", i), i));
        }
        
        buffer.clear();
        assert!(buffer.is_empty());
        assert_eq!(buffer.occupancy(), 0);
    }

    #[test]
    fn test_buffer_stats() {
        let mut buffer = VideoBuffer::new();
        
        for i in 0..10 {
            buffer.push(create_test_frame(&format!("frame{}", i), i));
        }
        
        let stats = buffer.stats();
        assert_eq!(stats.occupancy, 10);
        assert_eq!(stats.frames_received, 10);
        assert_eq!(stats.frames_extracted, 0);
    }

    #[test]
    fn test_keyframe_priority() {
        let mut config = VideoBufferConfig::default();
        config.max_frames = 2;
        let mut buffer = VideoBuffer::with_config(config);
        
        // Fill buffer
        buffer.push(create_test_frame("frame1", 1));
        buffer.push(create_test_frame("frame2", 2));
        
        // Keyframe should be accepted even when full
        let keyframe = create_keyframe("keyframe", 3);
        assert!(buffer.push(keyframe));
    }

    #[test]
    fn test_extraction_options() {
        let mut buffer = VideoBuffer::new();
        
        buffer.push(create_test_frame("frame1", 1));
        
        let options = ExtractionOptions {
            target_width: Some(320),
            target_height: Some(240),
            target_format: Some(PixelFormat::Rgba32),
            quality: QualityPreset::Medium,
        };
        
        let frame = buffer.extract_with_options(&options);
        assert!(frame.is_some());
        
        let frame = frame.unwrap();
        assert_eq!(frame.metadata.extra.get("target_width"), Some(&"320".to_string()));
        assert_eq!(frame.metadata.extra.get("target_height"), Some(&"240".to_string()));
    }

    #[test]
    fn test_buffer_stats_display() {
        let stats = BufferStats {
            occupancy: 10,
            max_frames: 30,
            target_depth: 3,
            frames_received: 100,
            frames_dropped: 5,
            frames_extracted: 90,
            drop_rate: 0.05,
        };
        
        let display = format!("{}", stats);
        assert!(display.contains("10/30 frames"));
        assert!(display.contains("100 received"));
        assert!(display.contains("5 dropped"));
        assert!(display.contains("5.0% drop rate"));
    }
}

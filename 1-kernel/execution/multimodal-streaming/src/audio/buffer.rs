//! Audio Buffer
//!
//! GAP-37: Implements audio stream buffering for jitter handling
//! Ring buffer with configurable latency

use crate::types::AudioFrame;
use std::collections::VecDeque;
use tracing::{debug, trace, warn};

/// Audio ring buffer for jitter handling
pub struct AudioBuffer {
    /// Internal buffer storage
    buffer: VecDeque<AudioFrame>,
    /// Sample rate
    sample_rate: u32,
    /// Number of channels
    channels: u16,
    /// Target buffer duration in milliseconds
    target_duration_ms: u64,
    /// Maximum buffer size (to prevent unbounded growth)
    max_size: usize,
    /// Current buffer duration in samples
    current_samples: usize,
}

impl AudioBuffer {
    /// Create a new audio buffer
    ///
    /// # Arguments
    /// * `sample_rate` - Sample rate in Hz
    /// * `channels` - Number of channels
    /// * `duration_ms` - Target buffer duration in milliseconds
    pub fn new(sample_rate: u32, channels: u16, duration_ms: u64) -> Self {
        // Calculate max size based on duration
        // Assuming 20ms frames at 48kHz = 960 samples per channel per frame
        let _samples_per_ms = sample_rate as f64 / 1000.0;
        let max_frames = ((duration_ms as f64 * 2.0) / 20.0).ceil() as usize; // 2x for safety
        let max_size = max_frames.max(50); // Minimum 50 frames

        Self {
            buffer: VecDeque::with_capacity(max_size),
            sample_rate,
            channels,
            target_duration_ms: duration_ms,
            max_size,
            current_samples: 0,
        }
    }

    /// Push a frame into the buffer
    pub fn push(&mut self, frame: AudioFrame) {
        // Calculate frame duration in samples
        let frame_samples = frame.samples.len();

        // Check if buffer is full
        if self.buffer.len() >= self.max_size {
            warn!(
                "AudioBuffer overflow (max: {}), dropping oldest frame",
                self.max_size
            );
            if let Some(oldest) = self.buffer.pop_front() {
                self.current_samples -= oldest.samples.len();
            }
        }

        trace!(
            "Pushing frame {} to buffer (samples: {}, buffer size: {})",
            frame.frame_id,
            frame_samples,
            self.buffer.len()
        );

        self.current_samples += frame_samples;
        self.buffer.push_back(frame);
    }

    /// Pop a frame from the buffer
    pub fn pop(&mut self) -> Option<AudioFrame> {
        self.buffer.pop_front().map(|frame| {
            self.current_samples -= frame.samples.len();
            trace!(
                "Popped frame {} from buffer (remaining: {})",
                frame.frame_id,
                self.buffer.len()
            );
            frame
        })
    }

    /// Peek at the next frame without removing it
    pub fn peek(&self) -> Option<&AudioFrame> {
        self.buffer.front()
    }

    /// Get buffer occupancy (number of frames)
    pub fn occupancy(&self) -> usize {
        self.buffer.len()
    }

    /// Get current buffer duration in milliseconds
    pub fn duration_ms(&self) -> u64 {
        if self.sample_rate == 0 || self.channels == 0 {
            return 0;
        }
        let samples_per_channel = self.current_samples / self.channels as usize;
        ((samples_per_channel as f64 / self.sample_rate as f64) * 1000.0) as u64
    }

    /// Get target buffer duration
    pub fn target_duration_ms(&self) -> u64 {
        self.target_duration_ms
    }

    /// Check if buffer has reached target duration
    pub fn is_ready(&self) -> bool {
        self.duration_ms() >= self.target_duration_ms
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    /// Clear all frames from the buffer
    pub fn clear(&mut self) {
        debug!(
            "Clearing audio buffer (dropping {} frames, {} samples)",
            self.buffer.len(),
            self.current_samples
        );
        self.buffer.clear();
        self.current_samples = 0;
    }

    /// Flush all frames from the buffer
    pub fn flush(&mut self) -> Vec<AudioFrame> {
        debug!("Flushing {} frames from buffer", self.buffer.len());
        let frames: Vec<AudioFrame> = self.buffer.drain(..).collect();
        self.current_samples = 0;
        frames
    }

    /// Get all frames without draining
    pub fn frames(&self) -> &VecDeque<AudioFrame> {
        &self.buffer
    }

    /// Resize the buffer with new target duration
    pub fn resize(&mut self, duration_ms: u64) {
        self.target_duration_ms = duration_ms;
        let max_frames = ((duration_ms as f64 * 2.0) / 20.0).ceil() as usize;
        self.max_size = max_frames.max(50);

        // Trim excess if needed
        while self.buffer.len() > self.max_size {
            if let Some(oldest) = self.buffer.pop_front() {
                self.current_samples -= oldest.samples.len();
            }
        }
    }

    /// Calculate jitter estimate based on frame timestamps
    pub fn jitter_ms(&self) -> f64 {
        if self.buffer.len() < 2 {
            return 0.0;
        }

        let mut total_diff = 0.0;
        let mut count = 0;
        let frames: Vec<_> = self.buffer.iter().collect();

        for i in 1..frames.len() {
            let t1 = frames[i - 1].timestamp.timestamp_millis() as f64;
            let t2 = frames[i].timestamp.timestamp_millis() as f64;
            let diff = (t2 - t1).abs();
            total_diff += diff;
            count += 1;
        }

        if count > 0 {
            total_diff / count as f64
        } else {
            0.0
        }
    }

    /// Get buffer statistics
    pub fn stats(&self) -> BufferStats {
        BufferStats {
            frame_count: self.buffer.len(),
            sample_count: self.current_samples,
            duration_ms: self.duration_ms(),
            target_duration_ms: self.target_duration_ms,
            jitter_ms: self.jitter_ms(),
            is_ready: self.is_ready(),
        }
    }
}

impl Default for AudioBuffer {
    fn default() -> Self {
        Self::new(48000, 2, 100) // 100ms default buffer
    }
}

/// Buffer statistics
#[derive(Debug, Clone)]
pub struct BufferStats {
    pub frame_count: usize,
    pub sample_count: usize,
    pub duration_ms: u64,
    pub target_duration_ms: u64,
    pub jitter_ms: f64,
    pub is_ready: bool,
}

impl std::fmt::Display for BufferStats {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "AudioBuffer: {} frames, {} samples, {}ms / {}ms, jitter: {:.2}ms, ready: {}",
            self.frame_count,
            self.sample_count,
            self.duration_ms,
            self.target_duration_ms,
            self.jitter_ms,
            self.is_ready
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AudioFrame, FrameMetadata};
    use chrono::Utc;

    fn create_test_frame(id: &str, samples: Vec<f32>) -> AudioFrame {
        AudioFrame {
            frame_id: id.to_string(),
            stream_id: "test".to_string(),
            timestamp: Utc::now(),
            samples,
            sample_rate: 48000,
            channels: 2,
            duration_ms: 20,
            metadata: FrameMetadata::default(),
        }
    }

    fn create_test_samples(count: usize) -> Vec<f32> {
        (0..count).map(|i| i as f32 / count as f32).collect()
    }

    #[test]
    fn test_buffer_creation() {
        let buffer = AudioBuffer::new(48000, 2, 100);
        assert_eq!(buffer.occupancy(), 0);
        assert_eq!(buffer.target_duration_ms(), 100);
        assert!(buffer.is_empty());
        assert!(!buffer.is_ready());
    }

    #[test]
    fn test_push_and_pop() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        let frame = create_test_frame("f1", create_test_samples(960));
        buffer.push(frame);

        assert_eq!(buffer.occupancy(), 1);

        let popped = buffer.pop();
        assert!(popped.is_some());
        assert_eq!(buffer.occupancy(), 0);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_buffer_duration() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        // 48000 samples/sec, 2 channels = 24000 frames/sec
        // 960 samples (2 channels) = 10ms at 48kHz stereo
        let frame = create_test_frame("f1", vec![0.0f32; 960]);
        buffer.push(frame);

        // 960 samples / 2 channels = 480 samples per channel
        // 480 / 48000 = 0.01 sec = 10ms
        assert_eq!(buffer.duration_ms(), 10);
    }

    #[test]
    fn test_is_ready() {
        let mut buffer = AudioBuffer::new(48000, 2, 50);

        // Push 5 frames of 10ms each = 50ms
        for i in 0..5 {
            let frame = create_test_frame(&format!("f{}", i), vec![0.0f32; 960]);
            buffer.push(frame);
        }

        assert!(buffer.is_ready());
    }

    #[test]
    fn test_clear() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        for i in 0..10 {
            let frame = create_test_frame(&format!("f{}", i), vec![0.0f32; 960]);
            buffer.push(frame);
        }

        assert_eq!(buffer.occupancy(), 10);

        buffer.clear();

        assert_eq!(buffer.occupancy(), 0);
        assert!(buffer.is_empty());
        assert_eq!(buffer.duration_ms(), 0);
    }

    #[test]
    fn test_flush() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        for i in 0..5 {
            let frame = create_test_frame(&format!("f{}", i), vec![0.0f32; 960]);
            buffer.push(frame);
        }

        let flushed = buffer.flush();
        assert_eq!(flushed.len(), 5);
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_peek() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        let frame = create_test_frame("f1", vec![0.0f32; 960]);
        buffer.push(frame);

        let peeked = buffer.peek();
        assert!(peeked.is_some());
        assert_eq!(peeked.unwrap().frame_id, "f1");
        assert_eq!(buffer.occupancy(), 1); // Still there
    }

    #[test]
    fn test_resize() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        // Fill buffer
        for i in 0..20 {
            let frame = create_test_frame(&format!("f{}", i), vec![0.0f32; 960]);
            buffer.push(frame);
        }

        // Resize to smaller target
        buffer.resize(50);

        assert_eq!(buffer.target_duration_ms(), 50);
    }

    #[test]
    fn test_buffer_stats() {
        let mut buffer = AudioBuffer::new(48000, 2, 100);

        let frame = create_test_frame("f1", vec![0.0f32; 960]);
        buffer.push(frame);

        let stats = buffer.stats();
        assert_eq!(stats.frame_count, 1);
        assert_eq!(stats.sample_count, 960);
        assert!(!stats.is_ready);
    }

    #[test]
    fn test_default_buffer() {
        let buffer: AudioBuffer = Default::default();
        assert_eq!(buffer.target_duration_ms(), 100);
        assert!(buffer.is_empty());
    }
}

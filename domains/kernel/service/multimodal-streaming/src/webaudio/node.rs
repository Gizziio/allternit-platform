//! WebAudio Nodes
//!
//! GAP-40: Audio node implementations
//! GainNode, PannerNode, and base AudioNode trait

use crate::types::AudioFrame;

/// Unique identifier for audio nodes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AudioNodeId(pub u64);

impl std::fmt::Display for AudioNodeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Node({})", self.0)
    }
}

/// Base trait for all audio nodes
pub trait AudioNode: Send + Sync {
    /// Get node ID
    fn id(&self) -> AudioNodeId;

    /// Process audio frame
    ///
    /// # Arguments
    /// * `input` - Optional input frame (None for source nodes)
    ///
    /// # Returns
    /// Optional output frame
    fn process(&mut self, input: Option<AudioFrame>) -> Option<AudioFrame>;

    /// Reset node state
    fn reset(&mut self);

    /// Get as Any for downcasting
    fn as_any(&self) -> &dyn std::any::Any;

    /// Get as Any for downcasting (mutable)
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any;

    /// Get number of inputs (default: 1)
    fn input_count(&self) -> usize {
        1
    }

    /// Get number of outputs (default: 1)
    fn output_count(&self) -> usize {
        1
    }
}

/// Gain node - applies gain/volume to audio
pub struct GainNode {
    id: AudioNodeId,
    sample_rate: u32,
    gain: f32,
    /// Smoothing factor for gain changes (0.0 = instant, 1.0 = no change)
    smoothing: f32,
    /// Current smoothed gain value
    current_gain: f32,
}

impl GainNode {
    /// Create a new gain node
    pub fn new(id: AudioNodeId, sample_rate: u32) -> Self {
        Self {
            id,
            sample_rate,
            gain: 1.0,
            smoothing: 0.9, // Smooth gain changes
            current_gain: 1.0,
        }
    }

    /// Set gain value (0.0 = silence, 1.0 = unity, >1.0 = amplification)
    pub fn set_gain(&mut self, gain: f32) {
        self.gain = gain.clamp(0.0, 10.0); // Allow up to 10x amplification
    }

    /// Get current gain setting
    pub fn gain(&self) -> f32 {
        self.gain
    }

    /// Get actual current gain (after smoothing)
    pub fn current_gain(&self) -> f32 {
        self.current_gain
    }

    /// Set smoothing factor
    pub fn set_smoothing(&mut self, smoothing: f32) {
        self.smoothing = smoothing.clamp(0.0, 0.999);
    }
}

impl AudioNode for GainNode {
    fn id(&self) -> AudioNodeId {
        self.id
    }

    fn process(&mut self, input: Option<AudioFrame>) -> Option<AudioFrame> {
        let mut frame = input?;

        // Apply smoothing to gain changes
        self.current_gain = self.smoothing * self.current_gain + (1.0 - self.smoothing) * self.gain;

        // Apply gain to each sample
        for sample in &mut frame.samples {
            *sample *= self.current_gain;
        }

        Some(frame)
    }

    fn reset(&mut self) {
        self.gain = 1.0;
        self.current_gain = 1.0;
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

impl Default for GainNode {
    fn default() -> Self {
        Self::new(AudioNodeId(0), 48000)
    }
}

/// Panner node - stereo panning
pub struct PannerNode {
    id: AudioNodeId,
    sample_rate: u32,
    /// Pan position: -1.0 (left) to 1.0 (right), 0.0 = center
    pan: f32,
    /// Smoothing factor for pan changes
    smoothing: f32,
    /// Current smoothed pan value
    current_pan: f32,
}

impl PannerNode {
    /// Create a new panner node
    pub fn new(id: AudioNodeId, sample_rate: u32) -> Self {
        Self {
            id,
            sample_rate,
            pan: 0.0, // Center by default
            smoothing: 0.9,
            current_pan: 0.0,
        }
    }

    /// Set pan position (-1.0 = left, 0.0 = center, 1.0 = right)
    pub fn set_pan(&mut self, pan: f32) {
        self.pan = pan.clamp(-1.0, 1.0);
    }

    /// Get current pan setting
    pub fn pan(&self) -> f32 {
        self.pan
    }

    /// Get actual current pan (after smoothing)
    pub fn current_pan(&self) -> f32 {
        self.current_pan
    }

    /// Set smoothing factor
    pub fn set_smoothing(&mut self, smoothing: f32) {
        self.smoothing = smoothing.clamp(0.0, 0.999);
    }

    /// Calculate left/right gain for a given pan position
    /// Uses constant power panning (sine/cosine law)
    fn calculate_gains(pan: f32) -> (f32, f32) {
        // pan: -1.0 (left) to 1.0 (right)
        // Convert to angle: 0 (left) to π/2 (right)
        let angle = (pan + 1.0) * std::f32::consts::PI / 4.0;

        let left_gain = angle.cos();
        let right_gain = angle.sin();

        (left_gain, right_gain)
    }
}

impl AudioNode for PannerNode {
    fn id(&self) -> AudioNodeId {
        self.id
    }

    fn process(&mut self, input: Option<AudioFrame>) -> Option<AudioFrame> {
        let mut frame = input?;

        // Only process stereo
        if frame.channels != 2 {
            return Some(frame);
        }

        // Apply smoothing to pan changes
        self.current_pan = self.smoothing * self.current_pan + (1.0 - self.smoothing) * self.pan;

        // Calculate gains
        let (left_gain, right_gain) = Self::calculate_gains(self.current_pan);

        // Apply panning to interleaved stereo samples
        for i in (0..frame.samples.len()).step_by(2) {
            if i + 1 < frame.samples.len() {
                frame.samples[i] *= left_gain; // Left channel
                frame.samples[i + 1] *= right_gain; // Right channel
            }
        }

        Some(frame)
    }

    fn reset(&mut self) {
        self.pan = 0.0;
        self.current_pan = 0.0;
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

impl Default for PannerNode {
    fn default() -> Self {
        Self::new(AudioNodeId(0), 48000)
    }
}

/// Destination node - final output
pub struct DestinationNode {
    id: AudioNodeId,
    sample_rate: u32,
    channel_count: u16,
}

impl DestinationNode {
    /// Create a new destination node
    pub fn new(id: AudioNodeId, sample_rate: u32, channel_count: u16) -> Self {
        Self {
            id,
            sample_rate,
            channel_count,
        }
    }

    /// Get channel count
    pub fn channel_count(&self) -> u16 {
        self.channel_count
    }
}

impl AudioNode for DestinationNode {
    fn id(&self) -> AudioNodeId {
        self.id
    }

    fn process(&mut self, input: Option<AudioFrame>) -> Option<AudioFrame> {
        // Destination just passes through (output is handled by context)
        input
    }

    fn reset(&mut self) {}

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }

    fn input_count(&self) -> usize {
        1
    }

    fn output_count(&self) -> usize {
        0 // Destination has no outputs
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{AudioFrame, FrameMetadata};
    use chrono::Utc;

    fn create_test_frame(samples: Vec<f32>) -> AudioFrame {
        AudioFrame {
            frame_id: "test".to_string(),
            stream_id: "stream".to_string(),
            timestamp: Utc::now(),
            samples,
            sample_rate: 48000,
            channels: 2,
            duration_ms: 20,
            metadata: FrameMetadata::default(),
        }
    }

    #[test]
    fn test_gain_node() {
        let mut gain = GainNode::new(AudioNodeId(1), 48000);
        assert_eq!(gain.gain(), 1.0);

        gain.set_gain(0.5);
        assert_eq!(gain.gain(), 0.5);

        // Test processing
        let frame = create_test_frame(vec![1.0, 1.0, 1.0, 1.0]);
        let output = gain.process(Some(frame)).unwrap();

        // After smoothing, gain won't be exactly 0.5
        assert!(output.samples.iter().all(|&s| s < 1.0 && s > 0.0));
    }

    #[test]
    fn test_gain_clamping() {
        let mut gain = GainNode::new(AudioNodeId(1), 48000);

        gain.set_gain(-0.5);
        assert_eq!(gain.gain(), 0.0);

        gain.set_gain(20.0);
        assert_eq!(gain.gain(), 10.0);
    }

    #[test]
    fn test_panner_node() {
        let mut panner = PannerNode::new(AudioNodeId(1), 48000);
        assert_eq!(panner.pan(), 0.0); // Center

        panner.set_pan(-1.0);
        assert_eq!(panner.pan(), -1.0);

        panner.set_pan(1.0);
        assert_eq!(panner.pan(), 1.0);
    }

    #[test]
    fn test_panner_clamping() {
        let mut panner = PannerNode::new(AudioNodeId(1), 48000);

        panner.set_pan(-2.0);
        assert_eq!(panner.pan(), -1.0);

        panner.set_pan(2.0);
        assert_eq!(panner.pan(), 1.0);
    }

    #[test]
    fn test_panner_gains() {
        // Center (0.0) should have equal gains
        let (left, right) = PannerNode::calculate_gains(0.0);
        assert!((left - right).abs() < 0.01);
        assert!(left > 0.7 && left < 0.8);

        // Left (-1.0) should have higher left gain
        let (left, right) = PannerNode::calculate_gains(-1.0);
        assert!(left > right);
        assert!(left > 0.99);

        // Right (1.0) should have higher right gain
        let (left, right) = PannerNode::calculate_gains(1.0);
        assert!(right > left);
        assert!(right > 0.99);
    }

    #[test]
    fn test_panner_processing() {
        let mut panner = PannerNode::new(AudioNodeId(1), 48000);
        panner.set_pan(-1.0); // Full left

        // Stereo: L=1.0, R=1.0
        let frame = create_test_frame(vec![1.0, 1.0, 1.0, 1.0]);
        let output = panner.process(Some(frame)).unwrap();

        // Left should be stronger than right
        assert!(output.samples[0] > output.samples[1]);
        assert!(output.samples[2] > output.samples[3]);
    }

    #[test]
    fn test_destination_node() {
        let mut dest = DestinationNode::new(AudioNodeId(0), 48000, 2);

        assert_eq!(dest.id().0, 0);
        assert_eq!(dest.channel_count(), 2);
        assert_eq!(dest.input_count(), 1);
        assert_eq!(dest.output_count(), 0);

        let frame = create_test_frame(vec![1.0, 1.0]);
        let output = dest.process(Some(frame));
        assert!(output.is_some());
    }

    #[test]
    fn test_node_reset() {
        let mut gain = GainNode::new(AudioNodeId(1), 48000);
        gain.set_gain(0.5);

        gain.reset();

        assert_eq!(gain.gain(), 1.0);
    }

    #[test]
    fn test_gain_smoothing() {
        let mut gain = GainNode::new(AudioNodeId(1), 48000);
        gain.set_smoothing(0.0); // No smoothing
        gain.set_gain(0.5);

        let frame = create_test_frame(vec![1.0, 1.0]);
        gain.process(Some(frame));

        // With no smoothing, current_gain should be close to target
        assert!((gain.current_gain() - 0.5).abs() < 0.01);
    }
}

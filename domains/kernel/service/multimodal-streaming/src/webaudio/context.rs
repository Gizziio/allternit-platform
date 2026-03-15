//! WebAudio Context
//!
//! GAP-40: Audio context management
//! Mimics browser WebAudio API AudioContext

use crate::types::{AudioFrame, StreamingError, StreamingResult, WebAudioSettings};
use crate::webaudio::{AudioGraph, AudioNode, AudioNodeId, GainNode, PannerNode};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, error, info, warn};

/// WebAudio context state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioContextState {
    /// Context is suspended
    Suspended,
    /// Context is running
    Running,
    /// Context is closed
    Closed,
}

/// Audio context - main entry point for WebAudio API
///
/// WIH: GAP-40, Owner: T2-A1
/// Provides audio context management similar to browser WebAudio API
pub struct AudioContext {
    /// Context identifier
    context_id: String,
    /// Sample rate in Hz
    sample_rate: u32,
    /// Current state
    state: RwLock<AudioContextState>,
    /// Audio processing graph
    graph: Arc<Mutex<AudioGraph>>,
    /// Destination node (output)
    destination: AudioNodeId,
    /// All nodes in the context
    nodes: RwLock<HashMap<AudioNodeId, Box<dyn AudioNode>>>,
    /// Next node ID
    next_node_id: RwLock<u64>,
    /// Frame output sender
    output_sender: mpsc::UnboundedSender<AudioFrame>,
    /// Current output time in samples
    current_time: RwLock<f64>,
    /// Base latency in seconds
    base_latency: f64,
    /// Output buffer size
    buffer_size: u32,
}

impl AudioContext {
    /// Create a new audio context with default settings
    pub fn new(context_id: impl Into<String>) -> (Self, mpsc::UnboundedReceiver<AudioFrame>) {
        let settings = WebAudioSettings::default();
        Self::with_settings(context_id, settings)
    }

    /// Create a new audio context with specific settings
    pub fn with_settings(
        context_id: impl Into<String>,
        settings: WebAudioSettings,
    ) -> (Self, mpsc::UnboundedReceiver<AudioFrame>) {
        let context_id = context_id.into();
        let (output_sender, output_receiver) = mpsc::unbounded_channel();

        let graph = Arc::new(Mutex::new(AudioGraph::new()));
        let destination = AudioNodeId(0); // Destination is always node 0

        let context = Self {
            context_id: context_id.clone(),
            sample_rate: settings.sample_rate,
            state: RwLock::new(AudioContextState::Suspended),
            graph: graph.clone(),
            destination,
            nodes: RwLock::new(HashMap::new()),
            next_node_id: RwLock::new(1), // Start at 1 since 0 is destination
            output_sender,
            current_time: RwLock::new(0.0),
            base_latency: settings.buffer_size as f64 / settings.sample_rate as f64,
            buffer_size: settings.buffer_size,
        };

        info!(
            "AudioContext {} created: {}Hz, buffer: {}, latency: {:.3}ms",
            context_id,
            context.sample_rate,
            context.buffer_size,
            context.base_latency * 1000.0
        );

        (context, output_receiver)
    }

    /// Get context ID
    pub fn context_id(&self) -> &str {
        &self.context_id
    }

    /// Get sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Get current state
    pub async fn state(&self) -> AudioContextState {
        *self.state.read().await
    }

    /// Get current time in seconds
    pub async fn current_time(&self) -> f64 {
        *self.current_time.read().await
    }

    /// Get base latency in seconds
    pub fn base_latency(&self) -> f64 {
        self.base_latency
    }

    /// Get destination node ID
    pub fn destination(&self) -> AudioNodeId {
        self.destination
    }

    /// Resume the audio context
    pub async fn resume(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        match *state {
            AudioContextState::Closed => {
                return Err(StreamingError::AudioProcessing(
                    "Cannot resume closed context".to_string(),
                ));
            }
            AudioContextState::Running => {
                warn!("AudioContext {} already running", self.context_id);
                return Ok(());
            }
            _ => {
                *state = AudioContextState::Running;
                info!("AudioContext {} resumed", self.context_id);
                Ok(())
            }
        }
    }

    /// Suspend the audio context
    pub async fn suspend(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = AudioContextState::Suspended;
        info!("AudioContext {} suspended", self.context_id);
        Ok(())
    }

    /// Close the audio context
    pub async fn close(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = AudioContextState::Closed;

        // Clear all nodes
        let mut nodes = self.nodes.write().await;
        nodes.clear();

        // Clear graph
        let mut graph = self.graph.lock().await;
        graph.clear();

        info!("AudioContext {} closed", self.context_id);
        Ok(())
    }

    /// Create a gain node
    pub async fn create_gain(&self) -> StreamingResult<AudioNodeId> {
        let id = self.allocate_node_id().await;
        let node = GainNode::new(id, self.sample_rate);

        let mut nodes = self.nodes.write().await;
        nodes.insert(id, Box::new(node));

        debug!("Created gain node {}", id.0);
        Ok(id)
    }

    /// Create a panner node (stereo panning)
    pub async fn create_panner(&self) -> StreamingResult<AudioNodeId> {
        let id = self.allocate_node_id().await;
        let node = PannerNode::new(id, self.sample_rate);

        let mut nodes = self.nodes.write().await;
        nodes.insert(id, Box::new(node));

        debug!("Created panner node {}", id.0);
        Ok(id)
    }

    /// Create a media stream source node
    pub async fn create_media_stream_source(
        &self,
        stream_id: impl Into<String>,
    ) -> StreamingResult<AudioNodeId> {
        let id = self.allocate_node_id().await;
        let node = MediaStreamSourceNode::new(id, stream_id.into(), self.sample_rate);

        let mut nodes = self.nodes.write().await;
        nodes.insert(id, Box::new(node));

        debug!("Created media stream source node {}", id.0);
        Ok(id)
    }

    /// Connect two nodes
    pub async fn connect(
        &self,
        from: AudioNodeId,
        to: AudioNodeId,
    ) -> StreamingResult<AudioNodeId> {
        // Validate nodes exist
        let nodes = self.nodes.read().await;
        if !nodes.contains_key(&from) && from != self.destination {
            return Err(StreamingError::AudioProcessing(format!(
                "Source node {} not found",
                from.0
            )));
        }
        if !nodes.contains_key(&to) && to != self.destination {
            return Err(StreamingError::AudioProcessing(format!(
                "Destination node {} not found",
                to.0
            )));
        }
        drop(nodes);

        // Add connection to graph
        let mut graph = self.graph.lock().await;
        graph.connect(from, to)?;

        debug!("Connected node {} to {}", from.0, to.0);
        Ok(to)
    }

    /// Disconnect a node
    pub async fn disconnect(&self, node_id: AudioNodeId) -> StreamingResult<()> {
        let mut graph = self.graph.lock().await;
        graph.disconnect(node_id)?;

        debug!("Disconnected node {}", node_id.0);
        Ok(())
    }

    /// Set gain value for a gain node
    pub async fn set_gain(&self, node_id: AudioNodeId, gain: f32) -> StreamingResult<()> {
        let mut nodes = self.nodes.write().await;

        if let Some(node) = nodes.get_mut(&node_id) {
            if let Some(gain_node) = node.as_any_mut().downcast_mut::<GainNode>() {
                gain_node.set_gain(gain);
                debug!("Set gain node {} to {}", node_id.0, gain);
                Ok(())
            } else {
                Err(StreamingError::AudioProcessing(format!(
                    "Node {} is not a gain node",
                    node_id.0
                )))
            }
        } else {
            Err(StreamingError::AudioProcessing(format!(
                "Node {} not found",
                node_id.0
            )))
        }
    }

    /// Set pan value for a panner node (-1.0 to 1.0)
    pub async fn set_pan(&self, node_id: AudioNodeId, pan: f32) -> StreamingResult<()> {
        let mut nodes = self.nodes.write().await;

        if let Some(node) = nodes.get_mut(&node_id) {
            if let Some(panner_node) = node.as_any_mut().downcast_mut::<PannerNode>() {
                panner_node.set_pan(pan);
                debug!("Set panner node {} pan to {}", node_id.0, pan);
                Ok(())
            } else {
                Err(StreamingError::AudioProcessing(format!(
                    "Node {} is not a panner node",
                    node_id.0
                )))
            }
        } else {
            Err(StreamingError::AudioProcessing(format!(
                "Node {} not found",
                node_id.0
            )))
        }
    }

    /// Process audio frame through the graph
    ///
    /// This is called to process incoming audio through the WebAudio graph
    pub async fn process(&self, input_frame: AudioFrame) -> StreamingResult<Option<AudioFrame>> {
        // Check state
        let state = self.state().await;
        if state != AudioContextState::Running {
            return Ok(None);
        }

        // Update current time
        {
            let mut time = self.current_time.write().await;
            let frame_duration = input_frame.samples.len() as f64
                / input_frame.channels as f64
                / self.sample_rate as f64;
            *time += frame_duration;
        }

        // Process through graph
        let graph = self.graph.lock().await;
        let output = graph.process(input_frame).await?;

        // Send to output if we have a result
        if let Some(ref frame) = output {
            if let Err(e) = self.output_sender.send(frame.clone()) {
                error!("Failed to send output frame: {}", e);
            }
        }

        Ok(output)
    }

    /// Remove a node from the context
    pub async fn remove_node(&self, node_id: AudioNodeId) -> StreamingResult<()> {
        // Disconnect first
        self.disconnect(node_id).await?;

        // Remove from nodes
        let mut nodes = self.nodes.write().await;
        nodes.remove(&node_id);

        debug!("Removed node {}", node_id.0);
        Ok(())
    }

    /// Get node count
    pub async fn node_count(&self) -> usize {
        self.nodes.read().await.len()
    }

    /// Allocate a new node ID
    async fn allocate_node_id(&self) -> AudioNodeId {
        let mut next_id = self.next_node_id.write().await;
        let id = AudioNodeId(*next_id);
        *next_id += 1;
        id
    }
}

/// Media stream source node
pub struct MediaStreamSourceNode {
    id: AudioNodeId,
    stream_id: String,
    sample_rate: u32,
}

impl MediaStreamSourceNode {
    fn new(id: AudioNodeId, stream_id: String, sample_rate: u32) -> Self {
        Self {
            id,
            stream_id,
            sample_rate,
        }
    }
}

impl AudioNode for MediaStreamSourceNode {
    fn id(&self) -> AudioNodeId {
        self.id
    }

    fn process(&mut self, input: Option<AudioFrame>) -> Option<AudioFrame> {
        // Pass through (actual media stream handling would be more complex)
        input
    }

    fn reset(&mut self) {}

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::FrameMetadata;

    #[tokio::test]
    async fn test_context_creation() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        assert_eq!(context.context_id(), "test_ctx");
        assert_eq!(context.sample_rate(), 48000);
        assert_eq!(context.state().await, AudioContextState::Suspended);
    }

    #[tokio::test]
    async fn test_context_resume_suspend() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        assert_eq!(context.state().await, AudioContextState::Suspended);

        context.resume().await.unwrap();
        assert_eq!(context.state().await, AudioContextState::Running);

        context.suspend().await.unwrap();
        assert_eq!(context.state().await, AudioContextState::Suspended);
    }

    #[tokio::test]
    async fn test_create_gain_node() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        let gain_id = context.create_gain().await.unwrap();
        assert_eq!(gain_id.0, 1);

        assert_eq!(context.node_count().await, 1);
    }

    #[tokio::test]
    async fn test_create_panner_node() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        let panner_id = context.create_panner().await.unwrap();
        assert_eq!(panner_id.0, 1);
    }

    #[tokio::test]
    async fn test_connect_nodes() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        let source_id = context.create_gain().await.unwrap();
        let dest_id = context.destination();

        let result = context.connect(source_id, dest_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_set_gain() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        let gain_id = context.create_gain().await.unwrap();
        context.set_gain(gain_id, 0.5).await.unwrap();

        // Would need getter to verify, but no error means success
    }

    #[tokio::test]
    async fn test_set_pan() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        let panner_id = context.create_panner().await.unwrap();
        context.set_pan(panner_id, -0.5).await.unwrap();
    }

    #[tokio::test]
    async fn test_process_frame() {
        let (context, mut receiver) = AudioContext::new("test_ctx");

        context.resume().await.unwrap();

        let frame = AudioFrame {
            frame_id: "test".to_string(),
            stream_id: "stream".to_string(),
            timestamp: chrono::Utc::now(),
            samples: vec![0.5, 0.5, 0.5, 0.5],
            sample_rate: 48000,
            channels: 2,
            duration_ms: 20,
            metadata: FrameMetadata::default(),
        };

        let result = context.process(frame).await.unwrap();
        assert!(result.is_some());

        // Check output
        let output = receiver.try_recv();
        assert!(output.is_ok());
    }

    #[tokio::test]
    async fn test_context_close() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        // Create some nodes
        let _ = context.create_gain().await.unwrap();
        let _ = context.create_panner().await.unwrap();

        assert_eq!(context.node_count().await, 2);

        context.close().await.unwrap();

        assert_eq!(context.state().await, AudioContextState::Closed);
        assert_eq!(context.node_count().await, 0);
    }

    #[tokio::test]
    async fn test_cannot_resume_closed() {
        let (context, _receiver) = AudioContext::new("test_ctx");

        context.close().await.unwrap();

        let result = context.resume().await;
        assert!(result.is_err());
    }
}

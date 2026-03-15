//! Audio Graph
//!
//! GAP-40: Audio processing graph management
//! Manages connections between nodes and processes audio through the graph

use crate::types::{AudioFrame, StreamingError, StreamingResult};
use crate::webaudio::AudioNodeId;
use std::collections::{HashMap, HashSet, VecDeque};
use tracing::{debug, trace, warn};

/// Audio processing graph
///
/// Manages node connections and topological processing order
pub struct AudioGraph {
    /// Connections: source -> [destinations]
    connections: HashMap<AudioNodeId, HashSet<AudioNodeId>>,
    /// Reverse connections: destination -> [sources]
    reverse_connections: HashMap<AudioNodeId, HashSet<AudioNodeId>>,
}

impl AudioGraph {
    /// Create a new empty audio graph
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
            reverse_connections: HashMap::new(),
        }
    }

    /// Connect two nodes
    pub fn connect(&mut self, from: AudioNodeId, to: AudioNodeId) -> StreamingResult<()> {
        // Prevent self-connection
        if from == to {
            return Err(StreamingError::AudioProcessing(
                "Cannot connect node to itself".to_string(),
            ));
        }

        // Add forward connection
        self.connections
            .entry(from)
            .or_insert_with(HashSet::new)
            .insert(to);

        // Add reverse connection
        self.reverse_connections
            .entry(to)
            .or_insert_with(HashSet::new)
            .insert(from);

        trace!("Connected node {} to {}", from.0, to.0);
        Ok(())
    }

    /// Disconnect a node (removes all connections)
    pub fn disconnect(&mut self, node_id: AudioNodeId) -> StreamingResult<()> {
        // Remove from all forward connections
        if let Some(destinations) = self.connections.remove(&node_id) {
            for dest in destinations {
                if let Some(sources) = self.reverse_connections.get_mut(&dest) {
                    sources.remove(&node_id);
                }
            }
        }

        // Remove from all reverse connections
        if let Some(sources) = self.reverse_connections.remove(&node_id) {
            for src in sources {
                if let Some(destinations) = self.connections.get_mut(&src) {
                    destinations.remove(&node_id);
                }
            }
        }

        // Remove any connections to this node from other nodes' forward lists
        for destinations in self.connections.values_mut() {
            destinations.remove(&node_id);
        }

        debug!("Disconnected node {}", node_id.0);
        Ok(())
    }

    /// Remove a specific connection
    pub fn disconnect_specific(
        &mut self,
        from: AudioNodeId,
        to: AudioNodeId,
    ) -> StreamingResult<()> {
        if let Some(destinations) = self.connections.get_mut(&from) {
            destinations.remove(&to);
        }

        if let Some(sources) = self.reverse_connections.get_mut(&to) {
            sources.remove(&from);
        }

        trace!("Disconnected specific connection {} -> {}", from.0, to.0);
        Ok(())
    }

    /// Get connections from a node
    pub fn get_connections(&self, from: AudioNodeId) -> Vec<AudioNodeId> {
        self.connections
            .get(&from)
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default()
    }

    /// Get sources connected to a node
    pub fn get_sources(&self, to: AudioNodeId) -> Vec<AudioNodeId> {
        self.reverse_connections
            .get(&to)
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default()
    }

    /// Check if a connection exists
    pub fn is_connected(&self, from: AudioNodeId, to: AudioNodeId) -> bool {
        self.connections
            .get(&from)
            .map(|destinations| destinations.contains(&to))
            .unwrap_or(false)
    }

    /// Get all nodes in the graph
    pub fn get_all_nodes(&self) -> HashSet<AudioNodeId> {
        let mut nodes = HashSet::new();

        for node in self.connections.keys() {
            nodes.insert(*node);
        }

        for destinations in self.connections.values() {
            for dest in destinations {
                nodes.insert(*dest);
            }
        }

        nodes
    }

    /// Process audio through the graph
    ///
    /// STUB_APPROVED: Full graph processing requires node storage
    /// This is a simplified version for basic processing
    pub async fn process(&self, input: AudioFrame) -> StreamingResult<Option<AudioFrame>> {
        // For now, just pass through the input
        // Full implementation would:
        // 1. Find source nodes (nodes with no inputs)
        // 2. Process in topological order
        // 3. Mix multiple inputs at each node
        // 4. Output from destination nodes

        trace!("Processing audio through graph (pass-through mode)");

        // STUB_APPROVED: Full graph processing pending
        Ok(Some(input))
    }

    /// Clear all connections
    pub fn clear(&mut self) {
        self.connections.clear();
        self.reverse_connections.clear();
        debug!("Cleared audio graph");
    }

    /// Check for cycles in the graph using DFS
    pub fn has_cycle(&self) -> bool {
        let nodes = self.get_all_nodes();
        let mut visited = HashSet::new();
        let mut recursion_stack = HashSet::new();

        for node in nodes {
            if !visited.contains(&node) {
                if self.dfs_check_cycle(node, &mut visited, &mut recursion_stack) {
                    return true;
                }
            }
        }

        false
    }

    /// DFS helper for cycle detection
    fn dfs_check_cycle(
        &self,
        node: AudioNodeId,
        visited: &mut HashSet<AudioNodeId>,
        recursion_stack: &mut HashSet<AudioNodeId>,
    ) -> bool {
        visited.insert(node);
        recursion_stack.insert(node);

        if let Some(neighbors) = self.connections.get(&node) {
            for neighbor in neighbors {
                if !visited.contains(neighbor) {
                    if self.dfs_check_cycle(*neighbor, visited, recursion_stack) {
                        return true;
                    }
                } else if recursion_stack.contains(neighbor) {
                    return true;
                }
            }
        }

        recursion_stack.remove(&node);
        false
    }

    /// Get topological sort of nodes
    pub fn topological_sort(&self) -> Option<Vec<AudioNodeId>> {
        if self.has_cycle() {
            warn!("Cannot topological sort: graph has cycles");
            return None;
        }

        let mut in_degree: HashMap<AudioNodeId, usize> = HashMap::new();
        let mut result = Vec::new();
        let mut queue = VecDeque::new();

        // Initialize in-degrees
        for node in self.get_all_nodes() {
            let degree = self.get_sources(node).len();
            in_degree.insert(node, degree);

            if degree == 0 {
                queue.push_back(node);
            }
        }

        // Process nodes
        while let Some(node) = queue.pop_front() {
            result.push(node);

            for neighbor in self.get_connections(node) {
                let degree = in_degree.get_mut(&neighbor).unwrap();
                *degree -= 1;

                if *degree == 0 {
                    queue.push_back(neighbor);
                }
            }
        }

        // Check if all nodes were processed
        if result.len() == self.get_all_nodes().len() {
            Some(result)
        } else {
            None // Should not happen if has_cycle() returned false
        }
    }

    /// Get connection count
    pub fn connection_count(&self) -> usize {
        self.connections.values().map(|set| set.len()).sum()
    }

    /// Get node count (unique nodes)
    pub fn node_count(&self) -> usize {
        self.get_all_nodes().len()
    }
}

impl Default for AudioGraph {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for AudioGraph {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AudioGraph")
            .field("connections", &self.connection_count())
            .field("nodes", &self.node_count())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_graph_creation() {
        let graph = AudioGraph::new();
        assert_eq!(graph.node_count(), 0);
        assert_eq!(graph.connection_count(), 0);
    }

    #[test]
    fn test_connect() {
        let mut graph = AudioGraph::new();

        let from = AudioNodeId(1);
        let to = AudioNodeId(2);

        graph.connect(from, to).unwrap();

        assert!(graph.is_connected(from, to));
        assert!(!graph.is_connected(to, from));
    }

    #[test]
    fn test_no_self_connection() {
        let mut graph = AudioGraph::new();

        let node = AudioNodeId(1);

        let result = graph.connect(node, node);
        assert!(result.is_err());
    }

    #[test]
    fn test_disconnect() {
        let mut graph = AudioGraph::new();

        let from = AudioNodeId(1);
        let to = AudioNodeId(2);

        graph.connect(from, to).unwrap();
        assert!(graph.is_connected(from, to));

        graph.disconnect(from).unwrap();
        assert!(!graph.is_connected(from, to));
    }

    #[test]
    fn test_disconnect_specific() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);
        let n3 = AudioNodeId(3);

        graph.connect(n1, n2).unwrap();
        graph.connect(n1, n3).unwrap();

        graph.disconnect_specific(n1, n2).unwrap();

        assert!(!graph.is_connected(n1, n2));
        assert!(graph.is_connected(n1, n3));
    }

    #[test]
    fn test_get_connections() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);
        let n3 = AudioNodeId(3);

        graph.connect(n1, n2).unwrap();
        graph.connect(n1, n3).unwrap();

        let connections = graph.get_connections(n1);
        assert_eq!(connections.len(), 2);
        assert!(connections.contains(&n2));
        assert!(connections.contains(&n3));
    }

    #[test]
    fn test_get_sources() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);
        let n3 = AudioNodeId(3);

        graph.connect(n1, n3).unwrap();
        graph.connect(n2, n3).unwrap();

        let sources = graph.get_sources(n3);
        assert_eq!(sources.len(), 2);
        assert!(sources.contains(&n1));
        assert!(sources.contains(&n2));
    }

    #[test]
    fn test_cycle_detection() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);
        let n3 = AudioNodeId(3);

        // n1 -> n2 -> n3 (no cycle)
        graph.connect(n1, n2).unwrap();
        graph.connect(n2, n3).unwrap();

        assert!(!graph.has_cycle());

        // n3 -> n1 creates cycle: n1 -> n2 -> n3 -> n1
        graph.connect(n3, n1).unwrap();

        assert!(graph.has_cycle());
    }

    #[test]
    fn test_topological_sort() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);
        let n3 = AudioNodeId(3);
        let n4 = AudioNodeId(4);

        // n1 -> n2 -> n4
        // n1 -> n3 -> n4
        graph.connect(n1, n2).unwrap();
        graph.connect(n2, n4).unwrap();
        graph.connect(n1, n3).unwrap();
        graph.connect(n3, n4).unwrap();

        let sorted = graph.topological_sort().unwrap();

        // n1 should come before n2, n3, n4
        let n1_pos = sorted.iter().position(|&n| n == n1).unwrap();
        let n2_pos = sorted.iter().position(|&n| n == n2).unwrap();
        let n3_pos = sorted.iter().position(|&n| n == n3).unwrap();
        let n4_pos = sorted.iter().position(|&n| n == n4).unwrap();

        assert!(n1_pos < n2_pos);
        assert!(n1_pos < n3_pos);
        assert!(n2_pos < n4_pos);
        assert!(n3_pos < n4_pos);
    }

    #[test]
    fn test_topological_sort_with_cycle() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);

        graph.connect(n1, n2).unwrap();
        graph.connect(n2, n1).unwrap();

        let sorted = graph.topological_sort();
        assert!(sorted.is_none());
    }

    #[test]
    fn test_clear() {
        let mut graph = AudioGraph::new();

        let n1 = AudioNodeId(1);
        let n2 = AudioNodeId(2);

        graph.connect(n1, n2).unwrap();
        assert_eq!(graph.connection_count(), 1);

        graph.clear();

        assert_eq!(graph.connection_count(), 0);
        assert_eq!(graph.node_count(), 0);
    }

    #[test]
    fn test_default() {
        let graph: AudioGraph = Default::default();
        assert_eq!(graph.node_count(), 0);
    }
}

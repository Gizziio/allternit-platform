//! Broadcast event bus for daemon-wide events.

use crate::protocol::Event;
use tokio::sync::broadcast;

/// Capacity of the broadcast ring; slow subscribers drop oldest events.
const BUS_CAPACITY: usize = 1024;

#[derive(Debug, Clone)]
pub struct EventBus {
    tx: broadcast::Sender<Event>,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(BUS_CAPACITY);
        Self { tx }
    }

    pub fn emit(&self, event: Event) {
        // No subscribers is not an error.
        let _ = self.tx.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.tx.subscribe()
    }
}

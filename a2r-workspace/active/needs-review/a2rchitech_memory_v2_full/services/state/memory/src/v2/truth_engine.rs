use crate::v2::conflict::{choose_strategy, resolve, ConflictStrategy};
use crate::v2::types::{MemoryTimeline};
use serde_json::Value;

pub struct TruthEngine;

impl TruthEngine {
    pub fn slot_key(_content: &Value, tags: &[String], metadata: &Value) -> Option<String> {
        let tl = tags.iter().map(|s| s.to_lowercase()).collect::<Vec<_>>();
        if tl.iter().any(|x| x == "employment") { return Some("slot:employment".into()); }
        if tl.iter().any(|x| x == "location") { return Some("slot:location".into()); }
        if tl.iter().any(|x| x == "diet") { return Some("slot:diet".into()); }

        if let Some(slot) = metadata.get("slot_key").and_then(|v| v.as_str()) {
            return Some(slot.to_string());
        }
        None
    }

    pub fn strategy(memory_type: &str, tags: &[String]) -> ConflictStrategy {
        choose_strategy(memory_type, tags)
    }

    pub fn apply(now: u64, existing: &mut MemoryTimeline, incoming: &mut MemoryTimeline, strategy: ConflictStrategy) {
        resolve(now, existing, incoming, strategy)
    }
}

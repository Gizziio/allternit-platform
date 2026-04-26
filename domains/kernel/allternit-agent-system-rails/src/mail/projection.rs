use std::path::PathBuf;

use anyhow::Result;

use crate::core::io::{append_json_line, ensure_dir};
use crate::core::types::AllternitEvent;

pub fn append_thread_event(root_dir: &PathBuf, event: &AllternitEvent) -> Result<()> {
    let thread_id = event.payload.get("thread_id").and_then(|v| v.as_str());
    let Some(thread_id) = thread_id else {
        return Ok(());
    };
    let dir = root_dir.join(".allternit/mail/threads");
    ensure_dir(&dir)?;
    let path = dir.join(format!("{}.jsonl", thread_id));
    append_json_line(&path, event)?;
    Ok(())
}

pub fn rebuild_threads(root_dir: &PathBuf, events: &[AllternitEvent]) -> Result<usize> {
    let mut buckets: std::collections::HashMap<String, Vec<AllternitEvent>> =
        std::collections::HashMap::new();
    for event in events {
        if let Some(thread_id) = event.payload.get("thread_id").and_then(|v| v.as_str()) {
            buckets
                .entry(thread_id.to_string())
                .or_default()
                .push(event.clone());
        }
    }
    let dir = root_dir.join(".allternit/mail/threads");
    ensure_dir(&dir)?;
    for (thread_id, events) in buckets.iter() {
        let path = dir.join(format!("{}.jsonl", thread_id));
        std::fs::write(&path, "")?;
        for event in events {
            append_json_line(&path, event)?;
        }
    }
    Ok(buckets.len())
}

use crate::v2::types::MemoryStatus;

pub struct DecayPolicy {
    pub active_to_archived_days: u64,
    pub superseded_to_archived_days: u64,
    pub min_access_keep_active: u32,
}

impl Default for DecayPolicy {
    fn default() -> Self {
        Self {
            active_to_archived_days: 90,
            superseded_to_archived_days: 180,
            min_access_keep_active: 5,
        }
    }
}

pub fn decay_status(now: u64, status: &MemoryStatus, last_accessed: u64, access_count: u32, policy: &DecayPolicy) -> Option<MemoryStatus> {
    let age_days = (now.saturating_sub(last_accessed)) / 86_400;
    match status {
        MemoryStatus::Active => {
            if access_count >= policy.min_access_keep_active { return None; }
            if age_days >= policy.active_to_archived_days { return Some(MemoryStatus::Archived); }
        }
        MemoryStatus::Superseded => {
            if age_days >= policy.superseded_to_archived_days { return Some(MemoryStatus::Archived); }
        }
        MemoryStatus::Archived => {}
    }
    None
}

pub fn time_decay_multiplier(now: u64, ts: u64) -> f64 {
    let age_days = ((now.saturating_sub(ts)) / 86_400) as f64;
    1.0 / (1.0 + (age_days / 30.0))
}

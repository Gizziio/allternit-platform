use crate::v2::types::{MemoryAuthority, MemoryStatus, MemoryTimeline};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictStrategy {
    OverwriteWithArchive,
    ParallelTruths,
    TemporalShift,
}

pub fn choose_strategy(memory_type: &str, tags: &[String]) -> ConflictStrategy {
    let t = tags.iter().map(|s| s.to_lowercase()).collect::<Vec<_>>();

    if t.iter().any(|x| x == "belief" || x == "opinion") {
        return ConflictStrategy::ParallelTruths;
    }
    if t.iter()
        .any(|x| x == "employment" || x == "location" || x == "role")
    {
        return ConflictStrategy::TemporalShift;
    }

    match memory_type {
        "Semantic" | "Declarative" => ConflictStrategy::OverwriteWithArchive,
        "Episodic" | "Working" => ConflictStrategy::TemporalShift,
        _ => ConflictStrategy::OverwriteWithArchive,
    }
}

pub fn resolve(
    now: u64,
    existing: &mut MemoryTimeline,
    incoming: &mut MemoryTimeline,
    strategy: ConflictStrategy,
) {
    match strategy {
        ConflictStrategy::ParallelTruths => {
            incoming.status = MemoryStatus::Active;
            incoming.valid_from = now;
            incoming.valid_to = None;
        }
        ConflictStrategy::TemporalShift | ConflictStrategy::OverwriteWithArchive => {
            existing.status = MemoryStatus::Superseded;
            existing.valid_to = Some(now);

            incoming.status = MemoryStatus::Active;
            incoming.valid_from = now;
            incoming.valid_to = None;

            let bump = match incoming.authority {
                MemoryAuthority::User => 0.10,
                MemoryAuthority::System => 0.05,
                MemoryAuthority::Agent => 0.0,
            };
            incoming.confidence = (incoming.confidence + bump).min(1.0);
        }
    }
}

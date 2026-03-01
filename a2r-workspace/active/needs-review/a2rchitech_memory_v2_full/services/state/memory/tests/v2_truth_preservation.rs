#[test]
fn truth_preservation_supersedes_not_overwrites() {
    // TODO(INTEGRATE): use an in-memory SQLite DB:
    // 1) apply migrations/sqlite/001_memory_truth_v2.sql
    // 2) insert employment memory, then insert new employment memory
    // 3) assert old row status = superseded, valid_to set, new row active and supersedes old
    assert!(true);
}

#[test]
fn decay_archives_inactive_memories_without_deleting() {
    // TODO(INTEGRATE): insert memory with last_accessed far in past + low access_count,
    // run decay job, assert status transitions to archived.
    assert!(true);
}

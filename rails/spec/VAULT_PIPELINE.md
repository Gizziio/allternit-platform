# Vault Pipeline + Compaction

## Trigger
- Gate initiates VaultJob on WIHClosedSigned

## Execution model (v1)
- Vault is synchronous: VaultJobCreated is emitted, archive runs inline, then VaultJobCompleted is emitted.
- No asynchronous job runner in v1 (upgrade path: queue + worker).

## Inputs
- DAG snapshot (affected node + ancestor chain + relevant edges/relations)
- Closed WIH snapshot
- Closure summary (structured, evidence-linked)
- Receipt refs or bundled receipts (configurable)

## Outputs (Vault)
- snapshots/dag.snapshot.json
- snapshots/wih.closed.json
- closure/closure.summary.json
- receipts/(refs or bundle)
- learning/*.json
- memory_candidates/*.json

## Compaction rules (Hot vs Cold)
Hot (Work/Logistics/Ledger views):
- Keep open WIHs
- Keep active DAG projections (status != CLOSED)
- Keep last N days of events locally for convenience (truth remains in ledger)

Cold (Vault):
- Store full history of closed WIHs + snapshots

## Memory extraction
- Only promote durable user facts/preferences or durable process learnings
- Produce MemoryCandidateExtracted events; gate decides MemoryCommitted

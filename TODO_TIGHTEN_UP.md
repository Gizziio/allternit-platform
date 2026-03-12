# Cowork Runtime - Tighten Up TODO

## Task 1: Consolidate Event Emission 🔄
- [ ] Identify all event emissions in `8-cloud/a2r-cloud-api/src/routes/runs.rs`.
- [ ] Ensure `RunServiceImpl` in `8-cloud/a2r-cloud-api/src/services/run_service.rs` handles all lifecycle events.
- [ ] Remove redundant `event_store.append` calls from `routes/runs.rs`.
- [ ] Verify event payloads are consistent between service and routes.

## Task 2: Implement Dynamic Filtering 🔍
- [ ] Update `RunListFilter` struct to support all intended fields.
- [ ] Rewrite `RunServiceImpl::list` to use dynamic SQL for `status`, `mode`, and `owner_id`.
- [ ] Ensure pagination (`limit`, `offset`) is correctly applied to the filtered results.

## Task 3: Harden CLI Streaming 🛡️
- [ ] Update `gizzi cowork attach` in `7-apps/cli/src/commands/cowork.rs`.
- [ ] Implement retry logic for SSE connection drops.
- [ ] Add support for `Last-Event-ID` if the API provides it (via sequence number).
- [ ] Improve error handling for malformed event data.

## Task 4: Refine Scheduler Logic 📅
- [ ] Enhance `calculate_next_run` in `8-cloud/a2r-cloud-api/src/routes/schedules.rs`.
- [ ] Ensure timezone-aware scheduling is correctly handled.
- [ ] Add validation for complex cron expressions.

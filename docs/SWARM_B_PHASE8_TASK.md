# Swarm B — Phase 8 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-b`  
**Branch:** `ao/p8-b`  
**Base:** `parity/swarm-sprint`

## Goal
Add user profiles and enrollment URLs for agents acting on behalf of humans.

## Deliverables

1. **User Profiles API**
   - Add `user_profiles` table with `id`, `org_id`, `agent_id`, `email`, `display_name`, `consent_given_at`, `enrollment_status`, `metadata`.
   - Add migration `V65__user_profiles.sql`.
   - Add `POST /beta/user-profiles`, `GET /beta/user-profiles`, `GET /beta/user-profiles/:id`, `PATCH /beta/user-profiles/:id`, `DELETE /beta/user-profiles/:id`.

2. **Enrollment URLs**
   - Add `POST /beta/user-profiles/:id/enrollment-url` that creates a signed, time-bound enrollment token.
   - Add `POST /beta/enroll` endpoint that accepts the token and records consent.
   - Store enrollment tokens in a new `enrollment_tokens` table with expiry.

3. **Tests**
   - Add Rust tests for profile CRUD, enrollment URL generation, and consent recording.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p8-b` with message: `feat(p8): Swarm B user profiles and enrollment URLs`.

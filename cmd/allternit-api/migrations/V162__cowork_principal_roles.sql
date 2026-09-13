-- ── Principal roles (A:// §3) ────────────────────────────────────────────────
-- Roles are not identities; a principal may hold several (orchestrator,
-- worker, reviewer, observer, human, system). Default principals (Al, Gizzi)
-- are seeded with roles at boot; user bots get roles at agent-linkage time.
ALTER TABLE cowork_principals ADD COLUMN roles TEXT NOT NULL DEFAULT '[]';

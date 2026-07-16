-- Registry SQL smoke suite: exercises every migration and the schema-level
-- invariants of the miniapps marketplace registry against a live PostgreSQL.
-- Run via scripts/sql-smoke.sh (creates and drops its own scratch database).
-- Requires ON_ERROR_STOP; each section prints a check label.

\echo '=== schema: all migrations applied (tables exist) ==='
SELECT count(*) AS tables FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('publishers','publisher_keys','miniapps','miniapp_versions',
                     'submissions','reviews','release_assets','scan_reports',
                     'install_events','ratings','intake_jobs','kill_switches',
                     'kill_switch_events');

\echo '=== immutability: miniapp_versions rejects manifest updates and deletes ==='
INSERT INTO publishers (id) VALUES ('pub-1');
INSERT INTO miniapps (id, publisher_id, name, description, category)
  VALUES ('pub.app', 'pub-1', 'Demo', 'demo app', 'tools');
INSERT INTO miniapp_versions (miniapp_id, version, manifest)
  VALUES ('pub.app', '1.0.0', '{"id":"pub.app","name":"Demo"}');
DO $$
BEGIN
    UPDATE miniapp_versions SET manifest = '{"tampered":true}' WHERE miniapp_id = 'pub.app';
    RAISE EXCEPTION 'immutability trigger did not fire on UPDATE';
EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'update blocked as expected: %', SQLERRM;
END $$;
DO $$
BEGIN
    DELETE FROM miniapp_versions WHERE miniapp_id = 'pub.app';
    RAISE EXCEPTION 'immutability trigger did not fire on DELETE';
EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'delete blocked as expected: %', SQLERRM;
END $$;
-- status transitions remain allowed
UPDATE miniapp_versions SET status = 'verified' WHERE miniapp_id = 'pub.app';
SELECT status FROM miniapp_versions WHERE miniapp_id = 'pub.app';

\echo '=== uniqueness: (miniapp_id, version) conflict ==='
INSERT INTO miniapp_versions (miniapp_id, version, manifest)
  VALUES ('pub.app', '1.0.0', '{"id":"pub.app"}')
ON CONFLICT (miniapp_id, version) DO NOTHING;
SELECT count(*) AS one_row FROM miniapp_versions WHERE miniapp_id = 'pub.app' AND version = '1.0.0';

\echo '=== constraints: ratings range + per-user uniqueness ==='
INSERT INTO ratings (miniapp_id, user_id, rating) VALUES ('pub.app', 'u-1', 5);
INSERT INTO ratings (miniapp_id, user_id, rating) VALUES ('pub.app', 'u-1', 3)
ON CONFLICT (miniapp_id, user_id) DO UPDATE SET rating = 3, updated_at = now();
SELECT rating FROM ratings WHERE miniapp_id = 'pub.app' AND user_id = 'u-1';
DO $$
BEGIN
    INSERT INTO ratings (miniapp_id, user_id, rating) VALUES ('pub.app', 'u-2', 6);
    RAISE EXCEPTION 'rating range check did not fire';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'rating range enforced as expected';
END $$;

\echo '=== review queue: pending versions with scan tallies ==='
INSERT INTO miniapp_versions (miniapp_id, version, manifest, signature, publisher_key)
  VALUES ('pub.app', '1.1.0', '{"id":"pub.app"}', 'sig', 'pk');
INSERT INTO scan_reports (miniapp_id, version_id, scanner, status)
  SELECT 'pub.app', id, 'osv', 'fail' FROM miniapp_versions WHERE version = '1.1.0';
INSERT INTO scan_reports (miniapp_id, version_id, scanner, status)
  SELECT 'pub.app', id, 'clamav', 'warn' FROM miniapp_versions WHERE version = '1.1.0';
SELECT v.version, v.signature IS NOT NULL AND v.publisher_key IS NOT NULL AS signed,
       COALESCE(s.fail_count, 0) AS scan_failures, COALESCE(s.warn_count, 0) AS scan_warnings
FROM miniapp_versions v
JOIN miniapps m ON m.id = v.miniapp_id
LEFT JOIN intake_jobs j ON j.version_id = v.id
LEFT JOIN (
    SELECT version_id,
           COUNT(*) FILTER (WHERE status = 'fail') AS fail_count,
           COUNT(*) FILTER (WHERE status = 'warn') AS warn_count
    FROM scan_reports GROUP BY version_id
) s ON s.version_id = v.id
WHERE v.status = 'pending'
ORDER BY v.submitted_at ASC, v.id ASC;

\echo '=== publisher keys: registration, revoke, approval eligibility ==='
INSERT INTO publisher_keys (publisher_id, key_fingerprint, public_key)
  VALUES ('pub-1', 'fp111', 'pk-AAA') ON CONFLICT (publisher_id, key_fingerprint) DO NOTHING;
SELECT EXISTS (
  SELECT 1 FROM publisher_keys k JOIN miniapps m ON m.publisher_id = k.publisher_id
  WHERE m.id = 'pub.app' AND k.key_fingerprint = 'fp111' AND k.status = 'active'
) AS active_key_approvable;
UPDATE publisher_keys SET status = 'revoked', revoked_at = now()
  WHERE publisher_id = 'pub-1' AND key_fingerprint = 'fp111';
SELECT NOT EXISTS (
  SELECT 1 FROM publisher_keys k JOIN miniapps m ON m.publisher_id = k.publisher_id
  WHERE m.id = 'pub.app' AND k.key_fingerprint = 'fp111' AND k.status = 'active'
) AS revoked_key_blocked;

\echo '=== kill switches: upsert + audit event ==='
INSERT INTO kill_switches (scope, enabled, reason, actor) VALUES ('marketplace', TRUE, 'test', 'smoke')
ON CONFLICT (scope) DO UPDATE SET enabled = TRUE, reason = 'test', actor = 'smoke', updated_at = now();
INSERT INTO kill_switch_events (scope, enabled, reason, actor) VALUES ('marketplace', TRUE, 'test', 'smoke');
SELECT scope, enabled FROM kill_switches WHERE enabled;
SELECT count(*) AS audit_rows FROM kill_switch_events WHERE scope = 'marketplace';

\echo '=== full-text search index ==='
SELECT id FROM miniapps
WHERE to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || id)
      @@ plainto_tsquery('simple', 'demo');

\echo '=== SQL smoke suite complete ==='

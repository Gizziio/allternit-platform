-- Assets are deduplicated per miniapp and kind: the same content may be
-- shared across miniapps (content-addressed keys), and re-registering an
-- asset moves its version pointer instead of failing.
ALTER TABLE release_assets
    DROP CONSTRAINT release_assets_kind_storage_key_key;
ALTER TABLE release_assets
    ADD CONSTRAINT release_assets_miniapp_kind_key UNIQUE (miniapp_id, kind, storage_key);

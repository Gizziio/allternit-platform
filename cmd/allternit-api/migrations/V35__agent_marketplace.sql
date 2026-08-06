-- Agent marketplace: publish/browse/search/install/rate shared agents
-- (PalsHub-equivalent, docs/SURFACE_AUDIT_FINAL_REPORT.md's biggest
-- Agents-vs-Pals structural gap — Allternit's Agents were local-only,
-- backend-CRUD, with no cross-user discovery layer at all).
--
-- A listing publishes a snapshot of one agent's config (not a live pointer)
-- so installers get their own independent, editable copy — same semantics
-- as agent-templates' `POST /agents/from-template` cloning, just sourced
-- from a user's own agent instead of a built-in template.

CREATE TABLE IF NOT EXISTS agent_marketplace_listings (
    id                  TEXT PRIMARY KEY,
    source_agent_id     TEXT NOT NULL REFERENCES agents(id),
    publisher_user_id   TEXT NOT NULL REFERENCES users(id),
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    category            TEXT,
    tags                TEXT,
    -- Snapshot of the publishing agent's config at publish time (model,
    -- provider, system_prompt, config incl. greeting/suggested_prompts,
    -- avatar) — JSON, same shape agent_routes.rs's CreateAgentBody accepts,
    -- so install can feed it straight into persist_agent.
    agent_snapshot      TEXT NOT NULL,
    rating_avg          REAL NOT NULL DEFAULT 0,
    rating_count        INTEGER NOT NULL DEFAULT 0,
    install_count       INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'published',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_publisher ON agent_marketplace_listings(publisher_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON agent_marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON agent_marketplace_listings(category);

CREATE TABLE IF NOT EXISTS agent_marketplace_ratings (
    id          TEXT PRIMARY KEY,
    listing_id  TEXT NOT NULL REFERENCES agent_marketplace_listings(id),
    user_id     TEXT NOT NULL REFERENCES users(id),
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review      TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (listing_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_ratings_listing ON agent_marketplace_ratings(listing_id);

CREATE TABLE IF NOT EXISTS agent_marketplace_installs (
    id                  TEXT PRIMARY KEY,
    listing_id          TEXT NOT NULL REFERENCES agent_marketplace_listings(id),
    user_id             TEXT NOT NULL REFERENCES users(id),
    installed_agent_id  TEXT NOT NULL REFERENCES agents(id),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketplace_installs_listing ON agent_marketplace_installs(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_installs_user ON agent_marketplace_installs(user_id);

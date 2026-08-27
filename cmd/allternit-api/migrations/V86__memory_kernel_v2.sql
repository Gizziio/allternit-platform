-- V86: Memory Kernel V2 - Additive Native Rust / SQLite Memory Pipeline

CREATE TABLE IF NOT EXISTS memory_observations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    session_id TEXT,
    kind TEXT NOT NULL, -- turn | file | tool | decision | checkpoint
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT
);

CREATE TABLE IF NOT EXISTS memory_facts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    fact TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_until DATETIME,
    source_observation_id TEXT REFERENCES memory_observations(id)
);

CREATE TABLE IF NOT EXISTS memory_entities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    summary TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_relationships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    confidence REAL DEFAULT 0.8,
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL, -- fact | entity | observation
    target_id TEXT NOT NULL,
    embedding BLOB NOT NULL,
    model TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_recall_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    session_id TEXT,
    query TEXT NOT NULL,
    results TEXT NOT NULL, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient recall and filtering
CREATE INDEX IF NOT EXISTS idx_memory_observations_user_agent ON memory_observations(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_observations_session ON memory_observations(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_observations_timestamp ON memory_observations(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_memory_facts_user_agent ON memory_facts(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_facts_valid ON memory_facts(valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_memory_entities_user_agent ON memory_entities(user_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_entities_name ON memory_entities(name);

CREATE INDEX IF NOT EXISTS idx_memory_relationships_source_target ON memory_relationships(source_entity_id, target_entity_id);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_target ON memory_embeddings(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_memory_recall_logs_user_agent ON memory_recall_logs(user_id, agent_id);

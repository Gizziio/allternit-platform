-- Additive graph memory (subject-predicate-object) for relational queries.
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS graph_edges (
    edge_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    confidence REAL NOT NULL DEFAULT 0.75,
    authority TEXT NOT NULL DEFAULT 'agent',
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    source_memory_id TEXT,
    source_resource_id TEXT,
    last_accessed INTEGER,
    access_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_graph_tenant ON graph_edges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_graph_subject ON graph_edges(subject);
CREATE INDEX IF NOT EXISTS idx_graph_predicate ON graph_edges(predicate);
CREATE INDEX IF NOT EXISTS idx_graph_object ON graph_edges(object);
CREATE INDEX IF NOT EXISTS idx_graph_status ON graph_edges(status);

COMMIT;

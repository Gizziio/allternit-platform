-- Dynamic benchmark leaderboard: stores published computer-use benchmark entries.
CREATE TABLE IF NOT EXISTS benchmark_results (
    id              TEXT PRIMARY KEY,
    benchmark       TEXT NOT NULL,
    agent           TEXT NOT NULL,
    organization    TEXT NOT NULL,
    success_rate    REAL NOT NULL,
    avg_steps       REAL NOT NULL,
    avg_latency_ms  INTEGER NOT NULL,
    safety_score    REAL NOT NULL,
    verified        BOOLEAN NOT NULL DEFAULT 0,
    rank            INTEGER NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benchmark_results_benchmark_rank
    ON benchmark_results(benchmark, rank);

-- Seed with the existing static leaderboard data.
INSERT INTO benchmark_results (id, benchmark, agent, organization, success_rate, avg_steps, avg_latency_ms, safety_score, verified, rank)
VALUES
    ('bm_1', 'Allternit Computer-Use Leaderboard', 'Allternit ACU (ultrabrowse)', 'Allternit', 0.87, 8.4, 12400, 0.96, 1, 1),
    ('bm_2', 'Allternit Computer-Use Leaderboard', 'Allternit ACU (standard)', 'Allternit', 0.82, 9.1, 10800, 0.94, 1, 2),
    ('bm_3', 'Allternit Computer-Use Leaderboard', 'Claude Computer Use', 'Anthropic', 0.79, 10.2, 15600, 0.92, 0, 3),
    ('bm_4', 'Allternit Computer-Use Leaderboard', 'Operator', 'OpenAI', 0.76, 11.3, 18200, 0.91, 0, 4),
    ('bm_5', 'Allternit Computer-Use Leaderboard', 'MCP Browser Agent', 'Community', 0.64, 13.5, 21500, 0.85, 0, 5)
ON CONFLICT(id) DO NOTHING;

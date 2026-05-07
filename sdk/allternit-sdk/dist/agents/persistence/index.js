class BunSqliteBackend {
    db;
    constructor(path) {
        // Dynamic import so this module loads even when Bun is not available
        const { Database } = require('bun:sqlite');
        this.db = new Database(path);
        this.init();
    }
    init() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        status TEXT,
        messages TEXT,
        metadata TEXT,
        updated_at INTEGER
      )
    `);
    }
    saveRun(record) {
        const query = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, messages, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        query.run(record.id, record.status, record.messages, record.metadata, record.updated_at);
    }
    getRun(id) {
        const query = this.db.prepare('SELECT * FROM runs WHERE id = ?');
        return query.get(id);
    }
    listRuns() {
        const query = this.db.prepare('SELECT * FROM runs ORDER BY updated_at DESC');
        return query.all();
    }
}
class NodeSqliteBackend {
    db;
    constructor(path) {
        const { DatabaseSync } = require('node:sqlite');
        this.db = new DatabaseSync(path);
        this.init();
    }
    init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        status TEXT,
        messages TEXT,
        metadata TEXT,
        updated_at INTEGER
      )
    `);
    }
    saveRun(record) {
        const insert = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, messages, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        insert.run(record.id, record.status, record.messages, record.metadata, record.updated_at);
    }
    getRun(id) {
        const query = this.db.prepare('SELECT * FROM runs WHERE id = ?');
        const row = query.get(id);
        return row;
    }
    listRuns() {
        const query = this.db.prepare('SELECT * FROM runs ORDER BY updated_at DESC');
        return query.all();
    }
}
class MemoryBackend {
    runs = new Map();
    saveRun(record) {
        this.runs.set(record.id, record);
    }
    getRun(id) {
        return this.runs.get(id) ?? null;
    }
    listRuns() {
        return Array.from(this.runs.values()).sort((a, b) => b.updated_at - a.updated_at);
    }
}
export class AgentStorage {
    backend;
    constructor(options = {}) {
        if (options.backend) {
            this.backend = options.backend;
        }
        else {
            const path = options.path ?? '.allternit/runs.db';
            this.backend = AgentStorage.createBackend(path);
        }
    }
    static createBackend(path) {
        if (path === ':memory:') {
            return new MemoryBackend();
        }
        try {
            return new BunSqliteBackend(path);
        }
        catch {
            try {
                return new NodeSqliteBackend(path);
            }
            catch {
                return new MemoryBackend();
            }
        }
    }
    saveRun(id, status, messages, metadata = {}) {
        this.backend.saveRun({
            id,
            status,
            messages: JSON.stringify(messages),
            metadata: JSON.stringify(metadata),
            updated_at: Date.now(),
        });
    }
    getRun(id) {
        return this.backend.getRun(id);
    }
    listRuns() {
        return this.backend.listRuns();
    }
}

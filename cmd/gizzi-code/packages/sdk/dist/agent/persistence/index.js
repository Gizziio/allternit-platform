/// <reference path="./bun-sqlite.d.ts" />
import { Database } from 'bun:sqlite';
export class AgentStorage {
    db;
    constructor(path = '.allternit/runs.db') {
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
    saveRun(id, status, messages, metadata = {}) {
        const query = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, messages, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        query.run(id, status, JSON.stringify(messages), JSON.stringify(metadata), Date.now());
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
//# sourceMappingURL=index.js.map
import { Database } from 'bun:sqlite';
import type { Message, AgentRunStatus } from '../types.js';

export interface RunRecord {
  id: string;
  status: AgentRunStatus;
  messages: string; // JSON string
  metadata: string; // JSON string
  updated_at: number;
}

export class AgentStorage {
  private db: Database;

  constructor(path: string = '.allternit/runs.db') {
    this.db = new Database(path);
    this.init();
  }

  private init() {
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

  public saveRun(id: string, status: AgentRunStatus, messages: Message[], metadata: any = {}) {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, messages, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    query.run(id, status, JSON.stringify(messages), JSON.stringify(metadata), Date.now());
  }

  public getRun(id: string): RunRecord | null {
    const query = this.db.prepare('SELECT * FROM runs WHERE id = ?');
    return query.get(id) as RunRecord | null;
  }

  public listRuns(): RunRecord[] {
    const query = this.db.prepare('SELECT * FROM runs ORDER BY updated_at DESC');
    return query.all() as RunRecord[];
  }
}

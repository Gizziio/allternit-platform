import type { AgentRunStatus } from '../types.js';

export interface RunRecord {
  id: string;
  status: AgentRunStatus;
  messages: string; // JSON string
  metadata: string; // JSON string
  updated_at: number;
}

export interface IAgentStorageBackend {
  saveRun(record: RunRecord): void;
  getRun(id: string): RunRecord | null;
  listRuns(): RunRecord[];
}

class BunSqliteBackend implements IAgentStorageBackend {
  private db: any;

  constructor(path: string) {
    // Dynamic import so this module loads even when Bun is not available
    const { Database } = require('bun:sqlite');
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

  saveRun(record: RunRecord) {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, messages, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    query.run(record.id, record.status, record.messages, record.metadata, record.updated_at);
  }

  getRun(id: string): RunRecord | null {
    const query = this.db.prepare('SELECT * FROM runs WHERE id = ?');
    return query.get(id) as RunRecord | null;
  }

  listRuns(): RunRecord[] {
    const query = this.db.prepare('SELECT * FROM runs ORDER BY updated_at DESC');
    return query.all() as RunRecord[];
  }
}

class NodeSqliteBackend implements IAgentStorageBackend {
  private db: any;

  constructor(path: string) {
    const { DatabaseSync } = require('node:sqlite');
    this.db = new DatabaseSync(path);
    this.init();
  }

  private init() {
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

  saveRun(record: RunRecord) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, messages, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insert.run(record.id, record.status, record.messages, record.metadata, record.updated_at);
  }

  getRun(id: string): RunRecord | null {
    const query = this.db.prepare('SELECT * FROM runs WHERE id = ?');
    const row = query.get(id);
    return row as RunRecord | null;
  }

  listRuns(): RunRecord[] {
    const query = this.db.prepare('SELECT * FROM runs ORDER BY updated_at DESC');
    return query.all() as RunRecord[];
  }
}

class MemoryBackend implements IAgentStorageBackend {
  private runs = new Map<string, RunRecord>();

  saveRun(record: RunRecord) {
    this.runs.set(record.id, record);
  }

  getRun(id: string): RunRecord | null {
    return this.runs.get(id) ?? null;
  }

  listRuns(): RunRecord[] {
    return Array.from(this.runs.values()).sort((a, b) => b.updated_at - a.updated_at);
  }
}

export class AgentStorage {
  private backend: IAgentStorageBackend;

  constructor(options: { path?: string; backend?: IAgentStorageBackend } = {}) {
    if (options.backend) {
      this.backend = options.backend;
    } else {
      const path = options.path ?? '.allternit/runs.db';
      this.backend = AgentStorage.createBackend(path);
    }
  }

  private static createBackend(path: string): IAgentStorageBackend {
    if (path === ':memory:') {
      return new MemoryBackend();
    }
    try {
      return new BunSqliteBackend(path);
    } catch {
      try {
        return new NodeSqliteBackend(path);
      } catch {
        return new MemoryBackend();
      }
    }
  }

  public saveRun(id: string, status: AgentRunStatus, messages: unknown[], metadata: any = {}) {
    this.backend.saveRun({
      id,
      status,
      messages: JSON.stringify(messages),
      metadata: JSON.stringify(metadata),
      updated_at: Date.now(),
    });
  }

  public getRun(id: string): RunRecord | null {
    return this.backend.getRun(id);
  }

  public listRuns(): RunRecord[] {
    return this.backend.listRuns();
  }
}

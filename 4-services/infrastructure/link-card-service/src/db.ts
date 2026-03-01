import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function initDB() {
  db = await open({
    filename: './links.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

export async function saveLink(id: string, payload: any) {
  if (!db) await initDB();
  await db?.run(
    'INSERT OR REPLACE INTO links (id, payload, created_at) VALUES (?, ?, ?)',
    id, JSON.stringify(payload), Date.now()
  );
}

export async function getLink(id: string) {
  if (!db) await initDB();
  const result = await db?.get('SELECT payload FROM links WHERE id = ?', id);
  return result ? JSON.parse(result.payload) : null;
}

export async function saveSession(id: string, data: any) {
  if (!db) await initDB();
  await db?.run(
    'INSERT OR REPLACE INTO sessions (id, data, created_at) VALUES (?, ?, ?)',
    id, JSON.stringify(data), Date.now()
  );
}

export async function getSession(id: string) {
  if (!db) await initDB();
  const result = await db?.get('SELECT data FROM sessions WHERE id = ?', id);
  return result ? JSON.parse(result.data) : null;
}


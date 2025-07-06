import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }

  db = await open({
    filename: './db/notes.db',
    driver: sqlite3.Database
  });

  // create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      iv TEXT NOT NULL,
      salt TEXT,
      delete_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      auth_tag TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON notes(expires_at);
  `);

  return db;
}

export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
} 
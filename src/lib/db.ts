import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Pool, PoolClient } from 'pg';

let sqliteDb: Database | null = null;
let pgPool: Pool | null = null;

// Determine database type from environment
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

export async function getDb(): Promise<Database | PoolClient> {
  if (isProduction && databaseUrl) {
    // Use PostgreSQL in production
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return pgPool.connect();
  } else {
    // Use SQLite in development
    if (!sqliteDb) {
      sqliteDb = await open({
        filename: './db/notes.db',
        driver: sqlite3.Database
      });

      // create tables if they don't exist
      await sqliteDb.exec(`
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
    }
    return sqliteDb;
  }
}

export async function closeDb() {
  if (sqliteDb) {
    await sqliteDb.close();
    sqliteDb = null;
  }
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

// Helper function to execute queries with proper error handling
export async function executeQuery(query: string, params: any[] = []) {
  const db = await getDb();
  
  try {
    if (isProduction && 'query' in db) {
      // PostgreSQL
      const result = await db.query(query, params);
      return result;
    } else if ('run' in db) {
      // SQLite - convert PostgreSQL syntax to SQLite
      const sqliteQuery = query
        .replace(/\$(\d+)/g, '?') // Replace $1, $2 with ?, ?
        .replace(/NOW\(\)/g, "datetime('now')"); // Replace NOW() with SQLite equivalent
      const result = await db.run(sqliteQuery, params);
      return result;
    }
  } finally {
    if (isProduction && 'release' in db) {
      db.release();
    }
  }
}

// Helper function to get single row
export async function getRow(query: string, params: any[] = []) {
  const db = await getDb();
  
  try {
    if (isProduction && 'query' in db) {
      // PostgreSQL
      const result = await db.query(query, params);
      return result.rows[0] || null;
    } else if ('get' in db) {
      // SQLite - convert PostgreSQL syntax to SQLite
      const sqliteQuery = query
        .replace(/\$(\d+)/g, '?') // Replace $1, $2 with ?, ?
        .replace(/NOW\(\)/g, "datetime('now')"); // Replace NOW() with SQLite equivalent
      const result = await db.get(sqliteQuery, params);
      return result;
    }
  } finally {
    if (isProduction && 'release' in db) {
      db.release();
    }
  }
}

// Helper function to get multiple rows
export async function getRows(query: string, params: any[] = []) {
  const db = await getDb();
  
  try {
    if (isProduction && 'query' in db) {
      // PostgreSQL
      const result = await db.query(query, params);
      return result.rows;
    } else if ('all' in db) {
      // SQLite - convert PostgreSQL syntax to SQLite
      const sqliteQuery = query
        .replace(/\$(\d+)/g, '?') // Replace $1, $2 with ?, ?
        .replace(/NOW\(\)/g, "datetime('now')"); // Replace NOW() with SQLite equivalent
      const result = await db.all(sqliteQuery, params);
      return result;
    }
  } finally {
    if (isProduction && 'release' in db) {
      db.release();
    }
  }
} 
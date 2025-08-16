import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Pool, PoolClient } from 'pg';

let sqliteDb: Database | null = null;
let pgPool: Pool | null = null;

// Determine database type from environment
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

// Database row type definitions
export interface NoteRow {
  id: string;
  message: string;
  iv: string;
  salt: string | null;
  delete_token: string;
  expires_at: string;
  created_at: string;
  auth_tag: string | null;
}

// Type definitions for our database operations
export interface DatabaseResult {
  rowCount?: number | null;
  rows?: unknown[];
}

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
      
      // Initialize PostgreSQL schema
      try {
        const client = await pgPool.connect();
        await client.query(`
          CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            iv TEXT NOT NULL,
            salt TEXT,
            delete_token TEXT NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            auth_tag TEXT
          );
          
          CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON notes(expires_at);
        `);
        client.release();
      } catch (error) {
        console.error('Failed to initialize PostgreSQL schema:', error);
      }
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
export async function executeQuery(query: string, params: unknown[] = []): Promise<DatabaseResult> {
  const db = await getDb();
  
  try {
    if (isProduction && 'query' in db) {
      // PostgreSQL
      const result = await db.query(query, params);
      return {
        rowCount: result.rowCount,
        rows: result.rows
      };
    } else if ('run' in db) {
      // SQLite - convert PostgreSQL syntax to SQLite
      const sqliteQuery = query
        .replace(/\$(\d+)/g, '?') // Replace $1, $2 with ?, ?
        .replace(/NOW\(\)/g, "datetime('now')"); // Replace NOW() with SQLite equivalent
      const result = await db.run(sqliteQuery, params);
      return {
        rowCount: result.changes !== null ? result.changes : 0,
        rows: []
      };
    }
    return { rowCount: 0, rows: [] };
  } finally {
    if (isProduction && 'release' in db) {
      db.release();
    }
  }
}

// Helper function to get single row
export async function getRow(query: string, params: unknown[] = []): Promise<NoteRow | null> {
  const db = await getDb();
  
  try {
    if (isProduction && 'query' in db) {
      // PostgreSQL
      const result = await db.query(query, params);
      return result.rows[0] as NoteRow || null;
    } else if ('get' in db) {
      // SQLite - convert PostgreSQL syntax to SQLite
      const sqliteQuery = query
        .replace(/\$(\d+)/g, '?') // Replace $1, $2 with ?, ?
        .replace(/NOW\(\)/g, "datetime('now')"); // Replace NOW() with SQLite equivalent
      const result = await db.get(sqliteQuery, params);
      return result as NoteRow || null;
    }
    return null;
  } finally {
    if (isProduction && 'release' in db) {
      db.release();
    }
  }
}

// Helper function to get multiple rows
export async function getRows(query: string, params: unknown[] = []): Promise<NoteRow[]> {
  const db = await getDb();
  
  try {
    if (isProduction && 'query' in db) {
      // PostgreSQL
      const result = await db.query(query, params);
      return result.rows as NoteRow[];
    } else if ('all' in db) {
      // SQLite - convert PostgreSQL syntax to SQLite
      const sqliteQuery = query
        .replace(/\$(\d+)/g, '?') // Replace $1, $2 with ?, ?
        .replace(/NOW\(\)/g, "datetime('now')"); // Replace NOW() with SQLite equivalent
      const result = await db.all(sqliteQuery, params);
      return result as NoteRow[];
    }
    return [];
  } finally {
    if (isProduction && 'release' in db) {
      db.release();
    }
  }
} 
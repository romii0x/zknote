-- Drop existing tables
DROP TABLE IF EXISTS notes;

-- Create notes table
CREATE TABLE notes (
    id TEXT PRIMARY KEY CHECK (length(id) = 22 AND id REGEXP '^[A-Za-z0-9_-]{22}$'),
    message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 140000),
    iv TEXT NOT NULL CHECK (iv REGEXP '^[A-Za-z0-9_-]{16,24}$'),
    salt TEXT CHECK (salt IS NULL OR salt REGEXP '^[A-Za-z0-9_-]{16,64}$'),
    delete_token TEXT NOT NULL CHECK (length(delete_token) = 32),
    expires_at TEXT NOT NULL CHECK (datetime(expires_at) > datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    auth_tag TEXT NOT NULL CHECK (length(auth_tag) > 0)
);

-- Create index for message expiration cleanup
CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON notes(expires_at);

-- Create index for note ID lookups
CREATE INDEX IF NOT EXISTS idx_notes_id ON notes(id);

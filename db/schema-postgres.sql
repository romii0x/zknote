-- PostgreSQL schema for zknote
-- This schema matches the SQLite schema but uses PostgreSQL-specific features for secure deployment

-- Drop existing tables
DROP TABLE IF EXISTS notes;

-- Create notes table with PostgreSQL-specific constraints
CREATE TABLE notes (
    id TEXT PRIMARY KEY CHECK (length(id) = 22 AND id ~ '^[A-Za-z0-9_-]{22}$'),
    message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 140000),
    iv TEXT NOT NULL CHECK (iv ~ '^[A-Za-z0-9_-]{16,24}$'),
    salt TEXT CHECK (salt IS NULL OR salt ~ '^[A-Za-z0-9_-]{16,64}$'),
    delete_token TEXT NOT NULL CHECK (length(delete_token) = 32),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL CHECK (expires_at > NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    auth_tag TEXT
);

-- Create indexes for performance
CREATE INDEX idx_notes_expires_at ON notes(expires_at);
CREATE INDEX idx_notes_id ON notes(id);
CREATE INDEX idx_notes_created_at ON notes(created_at);

-- clean up expired notesfunction
CREATE OR REPLACE FUNCTION cleanup_expired_notes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notes WHERE expires_at <= NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Cleaned up % expired notes', deleted_count;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- table comments
COMMENT ON TABLE notes IS 'Encrypted notes with automatic expiration';
COMMENT ON COLUMN notes.id IS 'Base64url-encoded UUID (22 characters)';
COMMENT ON COLUMN notes.message IS 'AES-GCM encrypted message content';
COMMENT ON COLUMN notes.iv IS 'Initialization vector for AES-GCM';
COMMENT ON COLUMN notes.salt IS 'Salt for PBKDF2 key derivation (optional)';
COMMENT ON COLUMN notes.delete_token IS 'Token required for note deletion';
COMMENT ON COLUMN notes.expires_at IS 'Timestamp when note expires';
COMMENT ON COLUMN notes.created_at IS 'Timestamp when note was created';
COMMENT ON COLUMN notes.auth_tag IS 'Authentication tag for AES-GCM';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, DELETE ON notes TO zknote_app;
-- GRANT USAGE ON SEQUENCE notes_id_seq TO zknote_app; 
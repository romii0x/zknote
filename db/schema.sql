-- Drop existing tables if they exist
DROP TABLE IF EXISTS messages;

-- Create messages table with enhanced security features
CREATE TABLE messages (
    id VARCHAR(22) PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{22}$'),
    message TEXT NOT NULL CHECK (LENGTH(message) <= 8000),
    iv VARCHAR(24) NOT NULL,
    salt VARCHAR(64) CHECK (salt IS NULL OR salt ~ '^[A-Za-z0-9_-]{16,64}$'),
    delete_token VARCHAR(32) NOT NULL,
    expires BIGINT NOT NULL CHECK (expires > EXTRACT(EPOCH FROM NOW() AT TIME ZONE 'UTC') * 1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT message_not_empty CHECK (LENGTH(message) > 0)
);

-- Create index for message expiration cleanup
CREATE INDEX idx_messages_expires ON messages (expires);

-- Grant minimal required permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON messages TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres; 
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function testNoteCreation() {
  try {
    console.log('Testing note creation...');
    
    const content = 'test note';
    const passphrase = 'test123';
    const ttl = '1d';
    
    // Generate salt and IV
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    
    // Derive key from passphrase
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    
    // Encrypt the content
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('zknote'));
    let encrypted = cipher.update(content, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    
    console.log('Encryption successful');
    
    // Test database
    const db = await open({
      filename: './db/notes.db',
      driver: sqlite3.Database
    });
    
    console.log('Database connection successful');
    
    // Create table if not exists
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
    `);
    
    console.log('Table creation successful');
    
    // Generate note ID and delete token
    const noteId = uuidv4().replace(/-/g, '');
    const deleteToken = crypto.randomBytes(16).toString('hex');
    
    // Set expiration
    const TTL_OPTIONS = {
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    const expiresAt = new Date(Date.now() + TTL_OPTIONS[ttl]).toISOString();
    
    // Insert into database
    await db.run(
      'INSERT INTO notes (id, message, iv, salt, delete_token, expires_at, auth_tag) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        noteId,
        encrypted,
        iv.toString('base64'),
        salt.toString('base64'),
        deleteToken,
        expiresAt,
        authTag.toString('base64'),
      ]
    );
    
    console.log('Database insert successful');
    console.log('Note ID:', noteId);
    
    await db.close();
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testNoteCreation(); 
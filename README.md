# ShoutBin

**ShoutBin** is a zero-knowledge, self-destructing pastebin for encrypted messages.  
All encryption and decryption occurs on the client side, ensuring the server never sees plaintext data.  
Each message is linked to a unique, unguessable URL and is automatically deleted after expiration or access.

---

## Features

- 🔐 **End-to-End Encryption**  
  Messages are encrypted and decrypted in the browser.

- 💥 **Self-Destructing Messages**  
  Messages expire after one view or a preset time limit.

- 🧠 **Zero Knowledge**  
  The server stores only ciphertext. Keys never leave the client.

---

## Development Log

**2025-05-19**
- Initialized project and site template
- Implemented PostgreSQL schema

**2025-05-20**
- Implemented zero-knowledge encryption
- Switched to base64url-encoded UUIDs for message IDs
- Added HTML escaping and stricter input validation
- Improved UI and error handling

**2025-05-22**
- Added JSON Schema input validation
- Implemented global rate limiting
- Enforced strong Content Security Policy headers

**2025-05-23**
- fixed iv encoding bug
- improved styling
- fixed message length error

---
## TODO:

### Security
- expired message clean up job
- create migration for messages:
```
CREATE TABLE messages (
  id VARCHAR(32) PRIMARY KEY,
  message TEXT NOT NULL,
  iv VARCHAR(32) NOT NULL,
  expires BIGINT NOT NULL
);
```
- HSTS headers
- db encryption at rest

### Site
- changing expiration time (could be a slider from *when accessed* to *7 days*)
- ui improvements

### Future
- passphrase-based key derivation for optional user passphrases
- anonymous usage analytics (maybe)

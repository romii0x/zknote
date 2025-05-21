# shoutbin
Anonymous pastebin for self-destructing messages.

ShoutBin stores encrypted messages identified by unique keys. Encryption and decryption happen entirely on the client side, so the server never sees plaintext data. Messages expire automatically upon access or after a set time.

Development Log/Notes:

5/19/2025
- created template for site
- implement database

5/20/2025
- implemented zero knowledge encryption
- improved ui
- now using full length base64url encoded uuid
- various security fixes (html escaping, validation, error handling)


## TODO:

#### Security
- validation on all inputs (almost done)
- expired message clean up job
- create migration for messages:
```
CREATE TABLE messages (
  id VARCHAR(32) PRIMARY KEY,
  message TEXT NOT NULL,
  iv TEXT NOT NULL,
  expires BIGINT NOT NULL
);
```
- test input sanitization
- implement rate limiting
- HSTS headers
- db encryption at rest

#### Site
- changing expiration time (could be a slider from *when accessed* to *7 days*)
- ui improvements

### Future
- passphrase-based key derivation for optional user passphrases
- anonymous usage analytics (maybe)

# shoutbin
Anonymous pastebin for self-destructing messages.


Development Log/Notes:

5/19/2025
- created template for site
- implement database

5/20/2025
- implemented zero knowledge architecture
- improved ui


## TODO:

#### Security
- validation on all inputs (almost done)
- expired message clean up job
- create migration for messages:
```
CREATE TABLE messages (
  id VARCHAR(8) PRIMARY KEY,
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
- ui elements (something simple and clean like bootstrap)

### Future
- passphrase-based key derivation for optional user passphrases
- anonymous usage analytics (maybe)

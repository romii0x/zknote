# shoutbin
Anonymous pastebin for self-destructing messages.


Development Log/Notes:

5/19/2025
- created template for site
- implement database

TODO:
- passphrase implementation
- create migration for messages:
```
CREATE TABLE messages (
  id VARCHAR(8) PRIMARY KEY,
  message TEXT NOT NULL,
  passphrase TEXT,
  expires BIGINT NOT NULL
);
```
- input sanitization
- rate limiting
- encryption
- clean up cron job
- changing expiration time
- ui

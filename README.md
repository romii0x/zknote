# shoutbin
Anonymous pastebin for self-destructing messages.


Development Log/Notes:

5/19/2025
- created template for site
- implement database

## TODO:

#### Security
- passphrase implementation using zero knowledge in format uuid+base64encodedkey
- create migration for messages (passphrase needs to be removed when zero knowledge encryption is added):
```
CREATE TABLE messages (
  id VARCHAR(8) PRIMARY KEY,
  message TEXT NOT NULL,
  passphrase TEXT,
  expires BIGINT NOT NULL
);
```
- basic security features including input sanitization, rate limiting, output encoding
- clean up cron job
#### Site
- changing expiration time (could be a slider from *when accessed* to *7 days*)
- ui elements (something simple and clean like bootstrap)

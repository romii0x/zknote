#### [< Back to Repo Page](https://github.com/ianshapiro1/shoutbin)

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

**2025-05-25**
- added expired message clean up job
- fixed error handling and improved delete upon access logic
    - shouts now attempt to delete upon access and completed decryption
- separated README into multiple documentation files and created changelog
- added optional passphrase for encryption


## TODO:

### Security
- create migration for messages:
```
CREATE TABLE messages (
  id VARCHAR(32) PRIMARY KEY,
  message TEXT NOT NULL,
  expires BIGINT NOT NULL,
  iv VARCHAR(32),
  salt TEXT
);
```
- HSTS headers

### Site
- changing expiration time (could be a slider from *when accessed* to *7 days*)
- ui improvements

### Future
- anonymous usage analytics (maybe)

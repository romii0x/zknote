#### [< Back to Repo Page](https://github.com/ianshapiro1/zknote)

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
  - notes now attempt to delete upon access and completed decryption
- separated README into multiple documentation files and created changelog
- added optional passphrase for encryption

**2025-05-26**

- added static view page for message viewing
- reworked encryption/ecryption logic to work with served file
  - reimplemented delete upon decryption after security review
  - server now returns json for /note/:id/data endpoint instead of embedded script
- ui improvements, glyphs for visible/invisible passphrases
- added folders for js and css files
- minor security fixes
  - strict use of dom building with textContent
  - visibility toggle glyphs for passphrases

**2025-05-29**

- improved user experience and reliability
  - added animated copy feedback with check.gif
  - fixed cleanup job timeout issues
  - improved error messages and user feedback
  - fixed message centering issues
- enhanced security measures
  - batched cleanup with advisory locks
  - proper resource cleanup and metrics
  - replaced innerHTML with safe DOM manipulation
  - improved CSP configuration
  - IP allowlisting for trusted clients
  - implemented constant-time responses
  - added proper error handling for cleanup jobs

**2025-06-01**

- implement a test suite for core functionality
- created a development build container using docker compose
- messages can now be up to 100k characters
- fixed how ssl is handled with environment variables
- ui/ux overhaul
- added message timeout selection

**2025-06-02**
- formatted codebase with prettier
- cleanup up comments around the app

**2025-06-20**
- removed legacy query helper

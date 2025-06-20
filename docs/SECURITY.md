#### [< Back to Repo Page](https://github.com/ianshapiro1/shoutbin)

# Security

ShoutBin is designed with a strong focus on privacy, anonymity, and zero-knowledge architecture. Below is a breakdown of its implemented and planned security features.

## Implemented

### Client-Side Security

#### Zero-Knowledge Encryption

- Client encryption/decryption using AES-GCM through the Web Crypto API
- Server never sees decrypted content or encryption keys
- Decryption key appended to URL fragment (#k=...), never sent to server
- Each message uses a random generated 96-bit IV via `crypto.getRandomValues()`
- Passphrases use PBKDF2 (100,000 iterations, SHA-256) and 128-bit salt
- Memory cleanup after encryption/decryption operations
- Sensitive data zeroing in memory after use

#### XSS Prevention

- All DOM manipulation uses safe methods (`textContent`, `createElement`)
- No `innerHTML` or direct HTML injection
- Strict input validation on all user inputs
- URL key parameter length limits enforced
- Content Security Policy blocks inline scripts and unsafe content

### Server-Side Security

#### Access Controls

- Unguessable URLs using 128 bit base64url-encoded UUIDs
- Authenticated delete tokens prevent unauthorized deletions
- No IP addresses or identifiers stored
- Messages are ephemeral and auto-delete after decryption
- All inputs are sanitized with json schema validation

#### Rate Limiting & Abuse Prevention

- Automatic IP banning for repeated violations
- Global and endpoint-specific limits
- Ban duration: 1 hour after 3 violations

#### Resource Protection

- Batched cleanup jobs with advisory locks
- Statement timeouts prevent long-running queries
- Metrics tracking for operational security
- Request logging for security events
- IP allowlisting for trusted clients

### Network Security

#### HTTP Security Headers

- Strict Content Security Policy
  - Default-src: 'none'
  - No inline scripts or styles
  - frame-ancestors: 'none'
- Cross-Origin Resource Sharing disabled by default
- HSTS enabled with preloading
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer
- Permissions-Policy restricts browser features

#### Anti-Timing Attack Measures

- Constant-time comparisons for sensitive operations
- Simulated delays normalize response times
- Consistent error responses prevent timing analysis
- Generic error messages prevent information leakage

#### User Interface Security

- Secure clipboard operations using Clipboard API
- Rate limit feedback with remaining attempts
- Automatic password visibility timeout
- Memory cleanup after sensitive operations

## Planned / In Progress

### Additional Security

- Browser memory barriers using SharedArrayBuffer
- Protection against browser developer tools manipulation
- Secure clipboard implementation with auto-clear
- Warning before page unload with sensitive data
- Client-side integrity checks (SRI)
- True exponential backoff for rate limiting
- Enhanced abuse monitoring and prevention

### UX Security Improvements

- Disable decrypt button during operations
- Add loading states for cryptographic operations
- Password strength indicators
- Add secure auto-clear timeouts for messages
- Improved error messages without leaking information
- Enhanced logging of encryption/decryption failures

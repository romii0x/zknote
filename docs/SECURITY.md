#### [< Back to Repo Page](https://github.com/ianshapiro1/shoutbin)

# 🔒 Security
ShoutBin is designed with a strong focus on privacy, anonymity, and zero-knowledge architecture. Below is a breakdown of its implemented and planned security features.

## ✅ Implemented

### ✅ Client-Side Security

#### ✅ Zero-Knowledge Encryption
- Encryption performed entirely client-side using AES-GCM through the Web Crypto API
- Server never sees decrypted content or encryption keys
- Decryption key appended to URL fragment (#k=...), never sent to server
- Each message uses a fresh, random 96-bit IV via `crypto.getRandomValues()`
- Optional passphrase mode with PBKDF2 (100,000 iterations, SHA-256) and 128-bit salt

#### ✅ XSS Prevention
- All DOM manipulation uses safe methods (`textContent`, `createElement`)
- No `innerHTML` or direct HTML injection
- Strict input validation on all user inputs
- URL key parameter length limits enforced
- Content Security Policy (CSP) blocks inline scripts and unsafe content

### ✅ Server-Side Security

#### ✅ Access Controls
- Unguessable URLs using base64url-encoded UUIDs (128-bit)
- Authenticated delete tokens prevent unauthorized deletions
- No IP addresses or identifiers stored
- Messages are ephemeral and auto-delete after access

#### ✅ Rate Limiting & Abuse Prevention
- Global rate limiting with IP-based tracking
- Automatic IP banning for repeated violations
- Endpoint-specific limits:
  - Message creation: 10 requests/minute
  - Message reading: 30 requests/minute
- Ban duration: 1 hour after 3 violations

#### ✅ Resource Protection
- Batched cleanup jobs with advisory locks
- Statement timeouts prevent long-running queries
- Proper error handling and resource cleanup
- Metrics tracking for operational security
- Request logging for security events
- IP allowlisting for trusted clients

### ✅ Network Security

#### ✅ HTTP Security Headers
- Strict Content Security Policy (CSP)
  - Default-src: 'none'
  - Script/Style/Image-src: 'self' (plus data: for images)
  - No inline scripts or styles
  - frame-ancestors: 'none' (prevents clickjacking)
- Cross-Origin Resource Sharing (CORS) disabled by default
- HSTS enabled with preloading
- X-Content-Type-Options: nosniff
- Referrer-Policy: no-referrer
- Permissions-Policy restricts browser features

#### ✅ Anti-Timing Attack Measures
- Constant-time comparisons for sensitive operations
- Simulated delays normalize response times
- Consistent error responses prevent timing analysis
- Generic error messages prevent information leakage

#### ✅ User Interface Security
- Secure clipboard operations using Clipboard API
- Visual feedback for security-critical actions
- Progressive error messages without information leakage
- Rate limit feedback with remaining attempts

## 🔧 Planned / In Progress

### 🔧 Additional Security
- Security audits and penetration testing
- Client-side integrity checks (SRI)
- True exponential backoff for rate limiting
- Enhanced abuse monitoring and prevention
- Automated security testing suite

### 🔧 UX Security Improvements
- Disable decrypt button during operations
- Add loading states for cryptographic operations
- password strength indicators
- Add secure auto-clear timeouts for messages
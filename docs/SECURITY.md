#### [< Back to Repo Page](https://github.com/ianshapiro1/shoutbin)

# 🔒 Security
ShoutBin is designed with a strong focus on privacy, anonymity, and zero-knowledge architecture. Below is a breakdown of its implemented and planned security features.

## ✅ Implemented
### ✅ Client-Side Encryption
Encryption is performed entirely client-side in the browser, using AES-GCM through the Web Crypto API

The server never sees the decrypted content or raw encryption keys.

### ✅ Zero-Knowledge URLs
The decryption key is appended to the URL as a fragment (#k=...).

This fragment is never sent to the server, ensuring true zero-knowledge architecture.

### ✅ Unguessable Links
URLs incorporate a 128-bit random UUID encoded in base64url to 22 characters.

This makes brute-forcing message URLs practically impossible.

### ✅ IV Trustworthiness
Each message is encrypted using AES-GCM with a fresh, random 96-bit Initialization Vector generated using `crypto.getRandomValues()`.
In passphrase mode, a 128-bit salt is also generated for PBKDF2 with 100,000 iterations, using SHA-256.

This setup ensures message confidentiality and integrity.

### ✅ No Logging or IP Tracking
No IP addresses, user agents, or identifiers are stored or logged.

Messages are ephemeral and cannot be linked back to users.

### ✅ XSS Mitigation
All user-generated content is inserted into the DOM using safe methods like `textContent` to prevent injection.

The application does not evaluate or execute any user input as code, eliminating typical XSS attack vectors.

### ✅ CSP (Content Security Policy)
Enforced using @fastify/helmet with strict CSP rules:

Only allows scripts, styles, and images from self.

Disallows all inline scripts and object embeds.

Prevents clickjacking via frame-ancestors 'none'.

### ✅ Rate Limiting & Abuse Protection
Basic rate limiting in place using @fastify/rate-limit with plans to improve.

100 requests per minute per IP.

Offending clients can be temporarily banned.

### ✅ Optional Passphrase-Based Encryption
Allows users to set a custom password to derive the encryption key.

Enhances security for users who prefer memorized secrets over URL fragments.

## 🔧 Planned / In Progress

### 🔧 HTTPS Redirect
For self-hosted deployments without a proxy, a redirect to HTTPS will be added.

### 🔧 Authenticated Delete Tokens
Each message will include a random delete token. 

This helps prevent malicious users from guessing or deleting messages.

### Timing Attack Mitigation
Avoid revealing whether a message ID exists or has expired until decryption succeeds.
Avoid telling the client why decryption failed.

### 🔧 Rate Limitng Improvements
Rate limiting should be applied per endpoint and utilize exponential backoff or temp banning.

### 🔧 Misc Security Enhancements
- Plan for security audits or penetration testing to identify vulnerabilities.
- Limit length of URL key param in view.js to prevent abuse.
- Disable decrypt button during decrypt operation.
- Explore client-side integrity checks e.g. SRI for scripts.
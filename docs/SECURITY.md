#### [< Back to Repo Page](https://github.com/ianshapiro1/shoutbin)

# 🔒 Security
ShoutBin is designed with a strong focus on privacy, anonymity, and zero-knowledge architecture. Below is a breakdown of its implemented and planned security features.

## ✅ Implemented
### ✅ Client-Side Encryption
All messages are encrypted in the browser using AES-GCM via window.crypto.subtle.

The server never sees the decrypted content, encryption keys, or IVs.

### ✅ Zero-Knowledge URLs
The decryption key is appended to the URL as a fragment (#k=...).

This fragment is never sent to the server, ensuring true zero-knowledge architecture.

### ✅ Unguessable Links
Uses a 128-bit random UUID encoded in base64url to 22 characters.

This makes brute-forcing message URLs practically impossible.

### ✅ No Logging or IP Tracking
No IP addresses, user agents, or identifiers are stored or logged.

Messages are ephemeral and cannot be linked back to users.

### ✅ CSP (Content Security Policy)
Enforced using @fastify/helmet with strict CSP rules:

Only allows scripts, styles, and images from self.

Disallows all inline scripts and object embeds.

Prevents clickjacking via frame-ancestors 'none'.

### ✅ Rate Limiting & Abuse Protection
Basic rate limiting in place using @fastify/rate-limit:

100 requests per minute per IP.

Offending clients can be temporarily banned.

### ✅ Optional Passphrase-Based Encryption
Allows users to set a custom password to derive the encryption key.

Enhances security for users who prefer memorized secrets over URL fragments.

## ⚠️ Planned / In Progress

### ⚠️ HTTPS Redirect
For self-hosted deployments without a proxy, a redirect to HTTPS will be added

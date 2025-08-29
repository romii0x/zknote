# zknote

### Securely share sensitive information with one-time access, no traces left behind.

**🌐 Live Demo:** [https://zknote.cc](https://zknote.cc)

- Confidently share passwords, backup codes, or keys on untrusted platforms
- Quickly and easily move plaintext data between devices
- Store time-sensitive data with flexible expiration times

## Features

- **Zero Knowledge**: Client-side AES-GCM 256-bit encryption
- **One-Time Access**: Messages are automatically deleted after successful decryption
- **Ephemeral**: Flexible expiration times from 1 minute to 1 week
- **Two Encryption Modes**:
  - **Random Key**: Generates a secure random key included in the share URL
  - **Passphrase**: Uses PBKDF2 with 100,000 iterations for key derivation
- **QR Code Generation**: Easy mobile sharing with QR codes

## How It Works

1. **Create**: Enter your message and choose expiration time
2. **Encrypt**: Message is encrypted client-side using Web Crypto API
3. **Share**: Get a unique URL with the encrypted message
4. **Access**: Recipient opens the URL and decrypts the message
5. **Destroy**: Message is automatically deleted after decryption

## Development Setup

```bash
# Clone the repository
git clone https://github.com/romii0x/zknote.git
cd zknote

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run type-check # Run TypeScript type checking
```

### Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/lib/` - Database utilities and cleanup functions
- `src/middleware.ts` - Rate limiting and security headers
- `public/` - Static assets
- `db/` - Database schema and SQLite files
- `infrastructure/` - Terraform configuration for AWS deployment

## Security Features

### Encryption
- **AES-GCM 256-bit** encryption for all messages
- **PBKDF2** with 100,000 iterations for passphrase-based keys
- **Random IV** generation for each message
- **Client-side only** encryption/decryption

### Rate Limiting
- **5 requests/minute** for note creation
- **20 requests/minute** for note retrieval
- **100 requests/minute** global limit
- **IP-based** tracking with automatic cleanup

### Timing Attack Protection
- **Random delays** (0-100ms) on all API responses
- **Constant-time** error responses regardless of failure reason
- **Consistent response timing** for both found and not found resources

### Security Headers
- **HSTS**: Strict Transport Security
- **CSP**: Content Security Policy (development mode)
- **X-Frame-Options**: Clickjacking protection
- **X-XSS-Protection**: XSS protection
- **X-Content-Type-Options**: MIME type sniffing protection
- **Referrer-Policy**: No referrer information leakage
- **CORS**: Same-origin policy enforcement

### Data Protection
- **Automatic deletion** after successful decryption
- **Expiration enforcement** with automatic cleanup jobs
- **No plaintext storage** - only encrypted data on server
- **Memory cleanup** of sensitive data after use

## Architecture

### Frontend
- **Next.js 14** with App Router
- **React 18** with hooks and TypeScript
- **Tailwind CSS** for styling
- **Web Crypto API** for encryption

### Backend
- **Next.js API Routes** for serverless functions
- **SQLite** for local development
- **PostgreSQL** for production (AWS RDS)
- **Automatic schema initialization**

## Deployment

- **AWS ECS Fargate** for container orchestration
- **AWS RDS PostgreSQL** for data storage
- **Application Load Balancer** with HTTPS
- **Auto-scaling** based on CPU utilization
- **GitHub Actions** CI/CD pipeline
- **AWS Certificate Manager** for SSL/TLS

### Cost Optimization

- **NAT Gateway disabled** to reduce costs
- **Single ECS task** with auto-scaling (0-2 instances)
- **CPU-based scaling** at 70% utilization
- **Automatic cleanup** to prevent storage bloat

[Infrastructure Documentation](infrastructure/terraform/README.md)  
[AWS Deployment Guide](DEPLOYMENT.md)

## Contributing

Contributions are welcome. If you have any additions or changes, open a PR!  
If you have an idea for a feature or encounter an error, please open an issue.

## License

[MIT](LICENSE)

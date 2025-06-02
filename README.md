# ShoutBin

Zero-knowledge, self-destructing pastebin service with client-side encryption.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/ianshapiro1/shoutbin.git
cd shoutbin

# Start with Docker
docker compose up

# Or start locally
npm install
createdb shoutbin_dev
psql shoutbin_dev < db/schema.sql
npm run dev
```

Visit `http://localhost:3000` to start using ShoutBin.

## 🛠 Development

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker and docker-compose (optional)

### Environment Variables

```env
# Required
DATABASE_URL=postgres://user:password@localhost:5432/dbname

# Optional with defaults
NODE_ENV=development          # development/production/test
PORT=3000                     # Server port
LOG_LEVEL=info               # fatal/error/warn/info/debug/trace
DB_SSL=false                 # Enable SSL for database
DB_CA_CERT=                  # Path to CA cert if DB_SSL=true
```

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm test        # Run test suite
npm run lint    # Run ESLint
npm run format  # Run Prettier
```

## 🔒 Security Features

- End-to-end encryption using AES-GCM 256
- Zero-knowledge architecture - server never sees plaintext
- Self-destructing messages after access or expiration
- Strict Content Security Policy and rate limiting
- See [Security Overview](docs/SECURITY.md) for details

## 📝 Documentation

- [Security Overview](docs/SECURITY.md)
- [Changelog](CHANGELOG.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Feature description'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)

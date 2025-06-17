# ShoutBin

Zero-knowledge, self-destructing pastebin service with client-side encryption.

## Features

- End-to-end encryption using AES-GCM 256
- Zero-knowledge architecture - server never sees plaintext
- Messages are deleted on successful decryption
- Message lifetime of up to 1 week
- Support up to 100000 characters per message
- Optional Passphrases

## Setup

```bash
# Clone the repository
git clone https://github.com/ianshapiro1/shoutbin.git
cd shoutbin

# Start with Docker
docker-compose build 
docker-compose up

# Or start locally
npm install
createdb shoutbin_dev
psql shoutbin_dev < db/schema.sql
npm run dev
```

## Development

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
npm run format  # Run Prettier
```

## Documentation

- [Security Overview](docs/SECURITY.md)
- [Changelog](CHANGELOG.md)

## Contributing

Contributions are welcome. If you have any additions or changes, open a PR!  
If you have an idea for a feature or encouter an error, please open an issue.

## License

[MIT](LICENSE)

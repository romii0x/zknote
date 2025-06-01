# ShoutBin

**ShoutBin** is a zero-knowledge, self-destructing pastebin for encrypted messages.  
All encryption and decryption occurs on the client side, ensuring the server never sees plaintext data.  
Each message is linked to a unique, unguessable URL and is automatically deleted after successful decryption or expiration.

## Features

- 🔐 **End-to-End Encryption**  
  Messages are encrypted and decrypted in the browser using AES-GCM 256.

- 💥 **Self-Destructing Messages**  
  Messages are deleted after successful decryption or expiration.

- 🧠 **Zero Knowledge**  
  The server stores only ciphertext. Encryption keys never leave the client.

## Local Development with Docker Compose

This project now supports seamless local development using Docker Compose. Both the app and a Postgres database will be started together, and the database schema will be initialized automatically.

### Prerequisites
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/)

### Quick Start

1. **Clone the repository:**
   ```sh
   git clone https://github.com/ianshapiro1/shoutbin.git
   cd shoutbin
   ```

2. **Start the app and database:**
   ```sh
   docker compose up --build
   ```
   - The app will be available at [http://localhost:3000](http://localhost:3000)
   - The database will persist data in a Docker-managed volume.
   - The schema is automatically created on first run.

3. **Stop the app:**
   ```sh
   docker compose down
   ```
   - To remove all data (reset the database):
     ```sh
     docker compose down --volumes
     ```

### Environment Variables
- Copy `.env.example` to `.env` and adjust as needed for custom setups.
- For local Docker Compose, no changes are needed by default.

### Manual (Non-Docker) Setup
If you want to run the app without Docker, you must:
- Install Node.js 20+
- Install Postgres 15+
- Create the database and run `db/schema.sql` manually
- Set up your `.env` file
- Start the app with `npm install && npm start`

## Configuration

ShoutBin can be configured using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | Required |
| `FORCE_HTTPS` | Enforce HTTPS redirects | false |
| `PORT` | Server port | 3000 |
| `LOG_LEVEL` | Logging level (fatal/error/warn/info/debug/trace) | info |

## Usage

Start the server:
```bash
npm start
```

The application will be available at `localhost:PORT`

## Contributing

Contributions are welcome! To get started:

- Fork the repo and create a new branch
- Make your changes
- Run the tests to make sure everything passes
- Submit a pull request with a clear description

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL 12+

### Running Tests
```bash
npm test
```

### Security Considerations
- Review [Security Overview](docs/SECURITY.md) before deployment
- Configure appropriate rate limits for your environment
- Enable HTTPS in production

## 📖 Documentation

- [🔐 Security Overview](docs/SECURITY.md)  
- [📋 Changelog](CHANGELOG.md)  

## License

[MIT](LICENSE)  
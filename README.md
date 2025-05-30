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


## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shoutbin.git
   cd shoutbin
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   ```bash
   # Create a PostgreSQL database
   createdb shoutbin

   # Apply the schema
   psql shoutbin < db/schema.sql
   ```

4. Configure environment variables:
   ```bash
   # Make environment file
   touch .env
   ```

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

### Message Creation
1. Enter your message
2. Optionally set a passphrase
3. Click "Create" to get a shareable link

### Message Retrieval
1. Open the received link
2. Enter passphrase if required
3. Message is displayed and automatically deleted

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
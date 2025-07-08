# zknote

### Generate ephemeral plaintext dead drops with one time access.

- Share sensitive data with confidence on platforms you don't trust
- Move keys, backup codes, or passwords across devices securely
- Store time sensitive data for later access or sharing

## Features

- **Zero Knowledge**: Client side E2EE using AES-GCM 256
- **One Time Access**: Messages are deleted on successful decryption
- **Ephemeral**: Set expiration windows from 1 minute to 1 week
- Optional passphrases and QR code generation

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ianshapiro1/zknote.git
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

- `src/app/` - App Router pages and API routes
- `src/lib/` - Database and utility functions
- `public/` - Static assets
- `db/` - SQLite database and schema

## Security

This is a zero-knowledge application where:
- All encryption/decryption happens in the browser
- The server never sees plaintext messages
- Keys are either derived from passphrases or generated randomly
- Messages are automatically deleted after successful decryption

## Contributing

Contributions are welcome. If you have any additions or changes, open a PR!  
If you have an idea for a feature or encounter an error, please open an issue.

## License

[MIT](LICENSE)

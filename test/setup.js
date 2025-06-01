// Set up test environment
process.env.NODE_ENV = 'test';
process.env.PORT = 3001; // Use different port for tests
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/shoutbin_test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.FORCE_HTTPS = 'false'; // Disable HTTPS redirect in tests

// Global test timeout
jest.setTimeout(10000); // 10 seconds 
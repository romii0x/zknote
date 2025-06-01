import { jest } from '@jest/globals';
import { setupDatabase, query } from '../../db/db.js';

describe('Database Tests', () => {
    let mockFastify;
    let mockPool;
    let mockClient;

    beforeEach(() => {
        // Mock client
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        // Mock pool
        mockPool = {
            connect: jest.fn().mockResolvedValue(mockClient)
        };

        // Mock fastify instance
        mockFastify = {
            register: jest.fn(),
            pg: {
                pool: mockPool
            },
            log: {
                error: jest.fn()
            }
        };

        // Make mockFastify globally available for legacy code
        global.fastify = mockFastify;
    });

    describe('setupDatabase', () => {
        test('registers postgres plugin with correct config', async () => {
            process.env.NODE_ENV = 'test';
            process.env.DATABASE_URL = 'test-db-url';

            await setupDatabase(mockFastify);

            expect(mockFastify.register).toHaveBeenCalledWith(
                expect.any(Function),
                {
                    connectionString: 'test-db-url',
                    ssl: false,
                    pool: {
                        min: 2,
                        max: 10,
                        idleTimeoutMillis: 30000,
                        connectionTimeoutMillis: 2000
                    }
                }
            );
        });

        test('configures SSL in production', async () => {
            process.env.NODE_ENV = 'production';
            process.env.DATABASE_URL = 'prod-db-url';
            process.env.DB_CA_CERT = 'test-cert';

            await setupDatabase(mockFastify);

            expect(mockFastify.register).toHaveBeenCalledWith(
                expect.any(Function),
                {
                    connectionString: 'prod-db-url',
                    ssl: {
                        rejectUnauthorized: true,
                        ca: 'test-cert'
                    },
                    pool: expect.any(Object)
                }
            );
        });
    });

    describe('query', () => {
        test('executes query and returns result', async () => {
            const expectedResult = { rows: [{ id: 1 }] };
            mockClient.query.mockResolvedValue(expectedResult);

            const result = await query('SELECT * FROM test', []);

            expect(result).toBe(expectedResult);
            expect(mockPool.connect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM test', []);
            expect(mockClient.release).toHaveBeenCalled();
        });

        test('releases client on error', async () => {
            const error = new Error('Database error');
            mockClient.query.mockRejectedValue(error);

            await expect(query('SELECT * FROM test', [])).rejects.toThrow(error);

            expect(mockClient.release).toHaveBeenCalled();
            expect(mockFastify.log.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    err: error,
                    query: 'SELECT * FROM test'
                }),
                'Database query error'
            );
        });

        test('handles connection failure', async () => {
            const error = new Error('Connection failed');
            mockPool.connect.mockRejectedValue(error);

            await expect(query('SELECT * FROM test', [])).rejects.toThrow(error);
        });
    });
}); 
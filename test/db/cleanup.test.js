import { jest } from '@jest/globals';
import { deleteExpiredMessages } from '../../jobs/cleanup.js';

describe('Cleanup Tests', () => {
    let mockFastify;
    let mockClient;

    beforeEach(() => {
        // Mock client
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        // Mock fastify instance
        mockFastify = {
            pg: {
                connect: jest.fn().mockResolvedValue(mockClient)
            },
            log: {
                info: jest.fn(),
                error: jest.fn()
            }
        };
    });

    test('successfully deletes expired messages in batches', async () => {
        // Mock first batch having 1000 messages, second batch 500, third batch 0
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ acquired: true }] }) // Lock acquisition
            .mockResolvedValueOnce({}) // Statement timeout
            .mockResolvedValueOnce({ rows: [{ count: '1000' }] })
            .mockResolvedValueOnce({ rows: [{ count: '500' }] })
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({}); // Lock release

        const result = await deleteExpiredMessages(mockFastify);

        expect(result).toEqual({
            success: true,
            deletedCount: 1500,
            errors: []
        });

        // Verify lock acquisition
        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('pg_try_advisory_lock')
        );

        // Verify statement timeout was set
        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('statement_timeout')
        );

        // Verify delete queries were made
        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM messages'),
            [expect.any(Number)]
        );

        // Verify lock release
        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('pg_advisory_unlock')
        );

        // Verify client was released
        expect(mockClient.release).toHaveBeenCalled();

        // Verify logging
        expect(mockFastify.log.info).toHaveBeenCalledWith(
            'Cleanup job deleted 1500 expired messages'
        );
    });

    test('handles lock acquisition failure', async () => {
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ acquired: false }] });

        const result = await deleteExpiredMessages(mockFastify);

        expect(result).toEqual({
            success: false,
            deletedCount: 0,
            errors: ['Failed to acquire cleanup lock - another job is running']
        });

        expect(mockClient.release).toHaveBeenCalled();
    });

    test('handles database query error', async () => {
        const error = new Error('Database error');
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(error);

        const result = await deleteExpiredMessages(mockFastify);

        expect(result).toEqual({
            success: false,
            deletedCount: 0,
            errors: [`Cleanup failed: ${error.message}`]
        });

        expect(mockFastify.log.error).toHaveBeenCalledWith(
            'Cleanup job error:',
            error
        );

        expect(mockClient.release).toHaveBeenCalled();
    });

    test('handles lock release failure', async () => {
        const error = new Error('Lock release failed');
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockRejectedValueOnce(error);

        const result = await deleteExpiredMessages(mockFastify);

        expect(result.errors).toContain(`Failed to cleanup resources: ${error.message}`);
        expect(mockFastify.log.error).toHaveBeenCalledWith(
            'Failed to cleanup resources:',
            error
        );
    });

    test('handles client release failure', async () => {
        const error = new Error('Release failed');
        mockClient.release.mockImplementation(() => {
            throw error;
        });
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({});

        const result = await deleteExpiredMessages(mockFastify);

        expect(result.errors).toContain(`Failed to cleanup resources: ${error.message}`);
        expect(mockFastify.log.error).toHaveBeenCalledWith(
            'Failed to cleanup resources:',
            error
        );
    });
}); 
import { describe, expect, test, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'crypto';
import Fastify from 'fastify';
import shoutPlugin from '../../api/shout.js';
import { setupDatabase } from '../../db/db.js';

describe('Shout API', () => {
    let fastify;
    let testMessage;

    beforeAll(async () => {
        // Create Fastify instance
        fastify = Fastify({ logger: false });
        await setupDatabase(fastify);
        await fastify.register(shoutPlugin);
        await fastify.ready();
    });

    beforeEach(() => {
        // Create test message data
        const message = randomBytes(32).toString('base64url');
        const iv = randomBytes(16).toString('base64url');
        testMessage = { message, iv };
    });

    afterAll(async () => {
        await fastify.close();
    });

    describe('POST /api/shout', () => {
        test('should create a message successfully', async () => {
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload: testMessage
            });

            const result = JSON.parse(response.payload);
            expect(response.statusCode).toBe(200);
            expect(result.id).toBeDefined();
            expect(result.url).toBeDefined();
            expect(result.deleteToken).toBeDefined();
            expect(result.url).toBe(`/shout/${result.id}`);
        });

        test('should reject invalid message format', async () => {
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload: {
                    message: '<script>alert("xss")</script>',
                    iv: testMessage.iv
                }
            });

            expect(response.statusCode).toBe(400);
        });

        test('should enforce message size limits', async () => {
            const longMessage = randomBytes(9000).toString('base64url');
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload: {
                    message: longMessage,
                    iv: testMessage.iv
                }
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('GET /api/shout/:id/data', () => {
        let messageId;
        let deleteToken;

        beforeEach(async () => {
            // Create a test message
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload: testMessage
            });
            const result = JSON.parse(response.payload);
            messageId = result.id;
            deleteToken = result.deleteToken;
        });

        test('should retrieve message successfully', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: `/api/shout/${messageId}/data`
            });

            const result = JSON.parse(response.payload);
            expect(response.statusCode).toBe(200);
            expect(result.message).toBe(testMessage.message);
            expect(result.iv).toBe(testMessage.iv);
        });

        test('should handle non-existent messages', async () => {
            const response = await fastify.inject({
                method: 'GET',
                url: '/api/shout/AAAAAAAAAAAAAAAAAAAAA_/data'
            });

            expect(response.statusCode).toBe(404);
        });

        test('should delete message after retrieval', async () => {
            // First retrieval
            const response1 = await fastify.inject({
                method: 'GET',
                url: `/api/shout/${messageId}/data`
            });
            expect(response1.statusCode).toBe(200);

            // Delete the message
            await fastify.inject({
                method: 'DELETE',
                url: `/api/shout/${messageId}`,
                headers: {
                    'x-delete-token': deleteToken
                }
            });

            // Second retrieval should fail
            const response2 = await fastify.inject({
                method: 'GET',
                url: `/api/shout/${messageId}/data`
            });
            expect(response2.statusCode).toBe(404);
        });
    });

    describe('DELETE /api/shout/:id', () => {
        let messageId;
        let deleteToken;

        beforeEach(async () => {
            // Create a test message
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload: testMessage
            });
            const result = JSON.parse(response.payload);
            messageId = result.id;
            deleteToken = result.deleteToken;
        });

        test('should delete message with valid token', async () => {
            const response = await fastify.inject({
                method: 'DELETE',
                url: `/api/shout/${messageId}`,
                headers: {
                    'x-delete-token': deleteToken
                }
            });

            expect(response.statusCode).toBe(200);
            const result = JSON.parse(response.payload);
            expect(result.success).toBe(true);
        });

        test('should reject invalid delete token', async () => {
            const response = await fastify.inject({
                method: 'DELETE',
                url: `/api/shout/${messageId}`,
                headers: {
                    'x-delete-token': 'invalid_token'
                }
            });

            expect(response.statusCode).toBe(404);
        });
    });
}); 
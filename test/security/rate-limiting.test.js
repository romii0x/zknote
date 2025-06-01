import { jest } from '@jest/globals';
import Fastify from 'fastify';
import shoutPlugin from '../../api/shout.js';

describe('Rate Limiting Tests', () => {
    let fastify;

    beforeEach(async () => {
        fastify = Fastify();
        await fastify.register(shoutPlugin);
    });

    afterEach(async () => {
        await fastify.close();
    });

    describe('Message Creation Rate Limits', () => {
        test('allows requests within rate limit', async () => {
            const payload = {
                message: 'test message',
                iv: 'test-iv-base64url'
            };

            // Should allow 5 requests per minute
            for (let i = 0; i < 5; i++) {
                const response = await fastify.inject({
                    method: 'POST',
                    url: '/api/shout',
                    payload
                });
                expect(response.statusCode).toBe(200);
            }
        });

        test('blocks requests exceeding rate limit', async () => {
            const payload = {
                message: 'test message',
                iv: 'test-iv-base64url'
            };

            // Make 6 requests (exceeding 5/minute limit)
            for (let i = 0; i < 5; i++) {
                await fastify.inject({
                    method: 'POST',
                    url: '/api/shout',
                    payload
                });
            }

            // 6th request should be blocked
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload
            });

            expect(response.statusCode).toBe(429);
            expect(JSON.parse(response.payload)).toEqual(
                expect.objectContaining({
                    error: 'Too many messages created. Please try again later.'
                })
            );
        });
    });

    describe('Message Retrieval Rate Limits', () => {
        test('allows requests within rate limit', async () => {
            // Should allow 20 requests per minute
            for (let i = 0; i < 20; i++) {
                const response = await fastify.inject({
                    method: 'GET',
                    url: '/api/shout/test-id/data'
                });
                // Will be 404 since message doesn't exist, but not rate limited
                expect(response.statusCode).toBe(404);
            }
        });

        test('blocks requests exceeding rate limit', async () => {
            // Make 21 requests (exceeding 20/minute limit)
            for (let i = 0; i < 20; i++) {
                await fastify.inject({
                    method: 'GET',
                    url: '/api/shout/test-id/data'
                });
            }

            // 21st request should be blocked
            const response = await fastify.inject({
                method: 'GET',
                url: '/api/shout/test-id/data'
            });

            expect(response.statusCode).toBe(429);
            expect(JSON.parse(response.payload)).toEqual(
                expect.objectContaining({
                    error: 'Too many message requests. Please try again later.'
                })
            );
        });
    });

    describe('IP-based Rate Limiting', () => {
        test('tracks limits per IP address', async () => {
            const payload = {
                message: 'test message',
                iv: 'test-iv-base64url'
            };

            // Make requests from different IPs
            const ip1 = '1.1.1.1';
            const ip2 = '2.2.2.2';

            // IP1 should get rate limited after 5 requests
            for (let i = 0; i < 6; i++) {
                const response = await fastify.inject({
                    method: 'POST',
                    url: '/api/shout',
                    payload,
                    headers: {
                        'x-forwarded-for': ip1
                    }
                });
                expect(response.statusCode).toBe(i < 5 ? 200 : 429);
            }

            // IP2 should still be allowed
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload,
                headers: {
                    'x-forwarded-for': ip2
                }
            });
            expect(response.statusCode).toBe(200);
        });
    });

    describe('Ban System', () => {
        test('bans IP after multiple rate limit violations', async () => {
            const payload = {
                message: 'test message',
                iv: 'test-iv-base64url'
            };
            const ip = '1.1.1.1';

            // Trigger rate limit 3 times
            for (let j = 0; j < 3; j++) {
                // Make 6 requests each time (exceeding limit)
                for (let i = 0; i < 6; i++) {
                    await fastify.inject({
                        method: 'POST',
                        url: '/api/shout',
                        payload,
                        headers: {
                            'x-forwarded-for': ip
                        }
                    });
                }
                // Wait for rate limit window to reset
                await new Promise(resolve => setTimeout(resolve, 60000));
            }

            // Should now be banned
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload,
                headers: {
                    'x-forwarded-for': ip
                }
            });

            expect(response.statusCode).toBe(403);
        });
    });

    describe('Rate Limit Headers', () => {
        test('includes rate limit headers in response', async () => {
            const response = await fastify.inject({
                method: 'POST',
                url: '/api/shout',
                payload: {
                    message: 'test message',
                    iv: 'test-iv-base64url'
                }
            });

            expect(response.headers).toEqual(
                expect.objectContaining({
                    'x-ratelimit-limit': expect.any(String),
                    'x-ratelimit-remaining': expect.any(String),
                    'x-ratelimit-reset': expect.any(String)
                })
            );
        });
    });
}); 
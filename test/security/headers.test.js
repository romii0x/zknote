import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

describe('Security Headers', () => {
    let fastify;

    beforeAll(async () => {
        fastify = Fastify({ logger: false });

        // Register security plugins
        await fastify.register(fastifyHelmet, {
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    defaultSrc: ["'none'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'"],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'none'"],
                    baseUri: ["'none'"],
                    frameAncestors: ["'none'"],
                    formAction: ["'self'"],
                    manifestSrc: ["'self'"]
                }
            }
        });

        await fastify.register(fastifyCors, {
            origin: false,
            methods: ['GET', 'POST', 'DELETE'],
            allowedHeaders: ['Content-Type', 'x-delete-token'],
            credentials: false,
            maxAge: 86400,
            exposedHeaders: [],
            preflight: false
        });

        // Add test route
        fastify.get('/test', async () => {
            return { hello: 'world' };
        });

        await fastify.ready();
    });

    afterAll(async () => {
        await fastify.close();
    });

    test('should set Content-Security-Policy header', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/test'
        });

        const csp = response.headers['content-security-policy'];
        expect(csp).toBeDefined();
        expect(csp).toContain("default-src 'none'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain("img-src 'self' data:");
    });

    test('should set CORS headers', async () => {
        const response = await fastify.inject({
            method: 'OPTIONS',
            url: '/test',
            headers: {
                'Origin': 'https://example.com',
                'Access-Control-Request-Method': 'GET'
            }
        });

        expect(response.headers['access-control-allow-origin']).toBeUndefined();
        expect(response.headers['access-control-allow-methods']).toBeDefined();
        expect(response.headers['access-control-max-age']).toBe('86400');
    });

    test('should set security headers', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/test'
        });

        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-xss-protection']).toBe('0');
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    test('should reject invalid CORS requests', async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/test',
            headers: {
                'Origin': 'https://evil.com'
            }
        });

        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
}); 
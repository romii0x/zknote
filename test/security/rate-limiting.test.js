import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

describe('Rate Limiting', () => {
  let fastify;
  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(rateLimit, { global: true, max: 2, timeWindow: '1 minute' });
    fastify.get('/limited', async () => 'ok');
    await fastify.ready();
  });
  afterAll(() => fastify.close());
  test('blocks after limit', async () => {
    const r1 = await fastify.inject({ method: 'GET', url: '/limited' });
    const r2 = await fastify.inject({ method: 'GET', url: '/limited' });
    const r3 = await fastify.inject({ method: 'GET', url: '/limited' });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r3.statusCode).toBe(429);
  });
}); 
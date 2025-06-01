import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';

describe('Security Headers', () => {
  let fastify;
  beforeAll(async () => {
    fastify = Fastify();
    await fastify.register(fastifyHelmet, { global: true });
    fastify.get('/test', async () => 'ok');
    await fastify.ready();
  });
  afterAll(() => fastify.close());
  test('sets security headers', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/test' });
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
}); 
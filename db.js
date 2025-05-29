import fastifyPostgres from '@fastify/postgres';

export async function setupDatabase(fastify) {
    await fastify.register(fastifyPostgres, {
        connectionString: process.env.DATABASE_URL,
        //ssl config here for prod
        //ssl: { rejectUnauthorized: false }
    });
}

// Legacy query helper for backward compatibility
export async function query(text, params) {
    const client = await global.fastify.pg.pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    } finally {
        client.release();
    }
}

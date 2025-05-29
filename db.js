import fastifyPostgres from '@fastify/postgres';

export async function setupDatabase(fastify) {
    const isProd = process.env.NODE_ENV === 'production';
    
    await fastify.register(fastifyPostgres, {
        connectionString: process.env.DATABASE_URL,
        ssl: isProd ? {
            rejectUnauthorized: true, // Enforce valid certificates in production
            // Add these if you have custom CA or client certificates
            // ca: fs.readFileSync('/path/to/ca.crt').toString(),
            // key: fs.readFileSync('/path/to/client-key.pem').toString(),
            // cert: fs.readFileSync('/path/to/client-cert.pem').toString()
        } : false
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

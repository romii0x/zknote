import fastifyPostgres from "@fastify/postgres";

export async function setupDatabase(fastify) {
  await fastify.register(fastifyPostgres, {
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ca: process.env.DB_CA_CERT,
          }
        : false,
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  });
};
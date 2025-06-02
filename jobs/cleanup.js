const CLEANUP_TIMEOUT = 2 * 60 * 1000; //2 minutes

async function acquireCleanupLock(client) {
  //try to acquire a lock using Postgres advisory locks
  const lockResult = await client.query(
    "SELECT pg_try_advisory_lock(hashtext('cleanup_job')) as acquired",
  );
  return lockResult.rows[0].acquired;
}

async function releaseCleanupLock(client) {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext('cleanup_job'))");
    return true;
  } catch (err) {
    fastify.log.error("Failed to release cleanup lock:", err);
    return false;
  }
}

export async function deleteExpiredMessages(fastify) {
  const metrics = {
    success: false,
    deletedCount: 0,
    errors: [],
  };

  const client = await fastify.pg.pool.connect();
  try {
    const lockAcquired = await acquireCleanupLock(client);
    if (!lockAcquired) {
      metrics.errors.push(
        "Failed to acquire cleanup lock - another job is running",
      );
      return metrics;
    }

    //set statement timeout to prevent long-running queries
    await client.query(`SET statement_timeout = ${CLEANUP_TIMEOUT}`);

    //delete expired messages in batches
    let totalDeleted = 0;
    while (true) {
      const result = await client.query(
        `WITH deleted AS (
                    DELETE FROM messages
                    WHERE id IN (
                        SELECT id FROM messages WHERE expires < $1 LIMIT 1000
                    )
                    RETURNING id
                )
                SELECT COUNT(*) as count FROM deleted`,
        [Date.now()],
      );

      const deletedCount = parseInt(result.rows[0].count);
      totalDeleted += deletedCount;

      if (deletedCount < 1000) break; //no more to delete
    }

    metrics.success = true;
    metrics.deletedCount = totalDeleted;

    if (totalDeleted > 0) {
      fastify.log.info(`Cleanup job deleted ${totalDeleted} expired messages`);
    }
  } catch (err) {
    metrics.errors.push(`Cleanup failed: ${err.message}`);
    fastify.log.error({ err }, "Cleanup job error");
  } finally {
    try {
      await releaseCleanupLock(client);
      await client.release();
    } catch (err) {
      metrics.errors.push(`Failed to cleanup resources: ${err.message}`);
      fastify.log.error({ err }, "Failed to cleanup resources");
    }
  }

  return metrics;
}

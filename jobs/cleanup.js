import { query } from "../db.js";

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

async function acquireCleanupLock(client) {
    // Try to acquire a lock using Postgres advisory locks
    const lockResult = await client.query(
        "SELECT pg_try_advisory_lock(hashtext('cleanup_job')) as acquired"
    );
    return lockResult.rows[0].acquired;
}

async function releaseCleanupLock(client) {
    await client.query(
        "SELECT pg_advisory_unlock(hashtext('cleanup_job'))"
    );
}

export async function deleteExpiredMessages(fastify) {
    const metrics = {
        startTime: Date.now(),
        deletedCount: 0,
        success: false,
        error: null
    };

    // Get a dedicated client from the pool
    const client = await fastify.pg.pool.connect();
    
    try {
        // Try to acquire the lock
        const lockAcquired = await acquireCleanupLock(client);
        if (!lockAcquired) {
            fastify.log.info("Cleanup already running in another instance");
            return;
        }

        // Begin transaction
        await client.query('BEGIN');

        // Delete expired messages
        const res = await client.query(
            `DELETE FROM messages 
             WHERE expires IS NOT NULL 
             AND expires < $1
             RETURNING id`,
            [Date.now()]
        );

        // Commit transaction
        await client.query('COMMIT');

        metrics.deletedCount = res.rowCount;
        metrics.success = true;

        if (res.rowCount > 0) {
            fastify.log.info({
                msg: `Deleted ${res.rowCount} expired shouts`,
                duration: Date.now() - metrics.startTime,
                ...metrics
            });
        }
    } catch (err) {
        // Rollback transaction on error
        await client.query('ROLLBACK');
        
        metrics.error = err.message;
        fastify.log.error({
            msg: "Cleanup job failed",
            error: err,
            ...metrics
        });

        // Re-throw error for the cron job to handle
        throw err;
    } finally {
        // Always release the lock and client
        try {
            await releaseCleanupLock(client);
        } catch (unlockErr) {
            fastify.log.error("Failed to release cleanup lock:", unlockErr);
        }
        client.release();
    }

    return metrics;
}
import { query } from "../db.js";

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const CLEANUP_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

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
    
    // Setup cleanup timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Cleanup operation timed out'));
        }, CLEANUP_TIMEOUT);
    });
    
    try {
        // Try to acquire the lock
        const lockAcquired = await acquireCleanupLock(client);
        if (!lockAcquired) {
            fastify.log.info("Cleanup already running in another instance");
            return metrics;
        }

        // Begin transaction
        await client.query('BEGIN');

        // Set statement timeout to prevent long-running queries (in milliseconds)
        await client.query("SET statement_timeout TO '" + CLEANUP_TIMEOUT + "'");

        // Delete expired messages with timeout
        const deletePromise = client.query(
            `DELETE FROM messages 
             WHERE expires IS NOT NULL 
             AND expires < $1
             RETURNING id`,
            [Date.now()]
        );

        // Wait for deletion with timeout
        const res = await Promise.race([deletePromise, timeoutPromise]);

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
        await client.query('ROLLBACK').catch(rollbackErr => {
            fastify.log.error('Failed to rollback transaction:', rollbackErr);
        });
        
        metrics.error = err.message;
        fastify.log.error({
            msg: "Cleanup job failed",
            error: err,
            ...metrics
        });

        // Re-throw error for the cron job to handle
        throw err;
    } finally {
        // Reset statement timeout
        await client.query('RESET statement_timeout').catch(resetErr => {
            fastify.log.error('Failed to reset statement timeout:', resetErr);
        });
        
        // Always release the lock and client
        try {
            await releaseCleanupLock(client);
        } catch (unlockErr) {
            fastify.log.error("Failed to release cleanup lock:", unlockErr);
        }
        
        // Always release the client
        await client.release();
    }

    return metrics;
}
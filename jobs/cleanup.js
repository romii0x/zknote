import { query } from "../db.js";

export async function deleteExpiredMessages(fastify) {
    try {
        const res = await query(
            `DELETE FROM messages WHERE expires IS NOT NULL AND expires < $1`,
            [Date.now()]
        );
        if (res.rowCount > 0) {
            fastify.log.info(`🧹 Deleted ${res.rowCount} expired shouts`);
        }
    } catch (err) {
        fastify.log.error("Cleanup job failed:", err);
    }
}
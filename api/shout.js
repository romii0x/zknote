import { randomUUID } from "crypto";
import { Buffer } from "buffer";
import { query } from "../db.js";

//helpers
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function uuidToBase64url(uuid) {
    const hex = uuid.replace(/-/g, "");
    const buffer = Buffer.from(hex, "hex");
    return buffer.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


//fastify routes
export default async function shoutPlugin(fastify) {
  // POST message to /api/shout
    fastify.post("/api/shout", async (request, reply) => {
        const { message, iv } = request.body;

        if (!message || typeof message !== "string" || message.length > 5000) {
            return reply.status(400).send({ error: "Invalid message" });
        }

        const id = uuidToBase64url(randomUUID());
        const expires = Date.now() + 24 * 60 * 60 * 1000; //24hrs hardcoded; needs changed once user preferences are set in frontend

        try {
            await query(
                `INSERT INTO messages (id, message, iv, expires) VALUES ($1, $2, $3, $4)`,
                [id, message, iv, expires]
            );
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: "Database insert failed" });
        }

        return { id, url: `/shout/${id}` };
  });

  // GET message at /shout/:id
    fastify.get("/shout/:id", async (request, reply) => {
        const { id } = request.params;

        try {
            const res = await query(
            `SELECT message, iv, expires FROM messages WHERE id = $1`,
            [id]
        );

        if (res.rowCount === 0) {
            return reply.status(404).type("text/html").send("<h2>Not found or expired</h2>");
        }

        const msg = res.rows[0];

        if (msg.expires < Date.now()) {
            await query(`DELETE FROM messages WHERE id = $1`, [id]);
            return reply.status(404).type("text/html").send("<h2>Not found or expired</h2>");
        }

        const safeMessage = escapeHtml(msg.message);
        const safeIv = escapeHtml(msg.iv);
        const safeId = escapeHtml(id);

        return reply.type("text/html").send(`
            <noscript><p>This site requires JavaScript to decrypt the message.</p></noscript>
            <div id="data" data-message="${safeMessage}" data-iv="${safeIv}" data-id="${safeId}"></div>
            <p id="status">Decrypting...</p>
            <script type="module" src="/decrypt.js"></script>
        `);
        
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).type("text/html").send("<h2>Server error</h2>");
        }
    });
    // DELETE message by id
    fastify.delete("/api/shout/:id", async (request, reply) => {
        const { id } = request.params;

        try {
            await query(`DELETE FROM messages WHERE id = $1`, [id]);
            return reply.status(204).send();
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: "Failed to delete message" });
        }
    });
}

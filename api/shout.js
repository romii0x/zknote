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

const idPattern = "^[A-Za-z0-9_-]{22}$"; //base64url from 128 bit uuid

//fastify routes
export default async function shoutPlugin(fastify) {
    //POST /api/shout
    fastify.post("/api/shout", {
        schema: {
            body: {
                type: "object",
                required: ["message", "iv"],
                properties: {
                message: { type: "string", minLength: 1, maxLength: 5000 },
                iv: {
                    type: "string",
                    pattern: "^[A-Za-z0-9_-]{16,24}$" //might need reviewed later
                }
                }
            },
            response: {
                200: {
                type: "object",
                properties: {
                    id: { type: "string", pattern: idPattern },
                    url: { type: "string" }
                }
                }
            }
        }
    }, async (request, reply) => {
        const { message, iv } = request.body;

        if (typeof iv !== "string" || iv.length > 32 || !/^[A-Za-z0-9_-]+$/.test(iv)) {
            return reply.status(400).send({ error: "Invalid IV format" });
        }
        
        const id = uuidToBase64url(randomUUID());
        const expires = Date.now() + 24 * 60 * 60 * 1000;

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

    //GET /shout/:id
    fastify.get("/shout/:id", {
        schema: {
            params: {
                type: "object",
                properties: {
                id: { type: "string", pattern: idPattern }
                },
                required: ["id"]
            }
        }
    }, async (request, reply) => {
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

    //DELETE /api/shout/:id
    fastify.delete("/api/shout/:id", {
        schema: {
        params: {
            type: "object",
            properties: {
            id: { type: "string", pattern: idPattern }
            },
            required: ["id"]
        }
        }
    }, async (request, reply) => {
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

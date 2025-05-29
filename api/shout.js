import { randomUUID } from "crypto";
import { Buffer } from "buffer";
import { query } from "../db.js";

// Constants
const MAX_MESSAGE_SIZE = 8000;
const MIN_MESSAGE_SIZE = 1;
const IV_PATTERN = "^[A-Za-z0-9_-]{16,24}$";
const SALT_PATTERN = "^[A-Za-z0-9_-]{16,64}$";
const ID_PATTERN = "^[A-Za-z0-9_-]{22}$"; //base64url from 128 bit uuid
const MESSAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Rate limit configurations
const createRateLimit = {
    max: 10,
    timeWindow: '1 minute',
    errorMessage: 'Too many messages created. Please try again later.'
};

const readRateLimit = {
    max: 30,
    timeWindow: '1 minute',
    errorMessage: 'Too many message requests. Please try again later.'
};

//helpers
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
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

async function deleteMessage(fastify, id) {
    try {
        await query(`DELETE FROM messages WHERE id = $1`, [id]);
        fastify.log.info(`🗑️ Deleted message: ${id}`);
        return true;
    } catch (err) {
        fastify.log.error({ err, id }, "Failed to delete message");
        return false;
    }
}

// Error response helper
function errorResponse(statusCode, message, details = null) {
    const response = { 
        error: message,
        statusCode 
    };
    if (details) {
        response.details = details;
    }
    return response;
}

//fastify routes
export default async function shoutPlugin(fastify) {
    //POST /shout
    fastify.post("/api/shout", {
        config: {
            rateLimit: createRateLimit
        },
        schema: {
            body: {
                type: "object",
                required: ["message", "iv"],
                properties: {
                    message: { 
                        type: "string", 
                        minLength: MIN_MESSAGE_SIZE, 
                        maxLength: MAX_MESSAGE_SIZE 
                    },
                    iv: {
                        type: "string",
                        pattern: IV_PATTERN
                    },
                    salt: {
                        type: "string",
                        pattern: SALT_PATTERN
                    }
                },
                additionalProperties: false
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        id: { type: "string", pattern: ID_PATTERN },
                        url: { type: "string" }
                    }
                },
                '4xx': {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        statusCode: { type: "number" },
                        details: { type: "object" }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { message, iv, salt } = request.body;

        try {
            //create UUID and set expiration
            const id = uuidToBase64url(randomUUID());
            const expires = Date.now() + MESSAGE_EXPIRY;

            //create the database entry
            await query(
                `INSERT INTO messages (id, message, iv, salt, expires) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, message, iv, salt || null, expires]
            );

            fastify.log.info({ id, messageLength: message.length }, "Message created");
            return { id, url: `/shout/${id}` };
        } catch (err) {
            fastify.log.error(err, "Failed to create message");
            return reply.status(500).send(
                errorResponse(500, "Failed to create message")
            );
        }
    });

    //GET /shout/:id - serve file
    fastify.get("/shout/:id", {
        config: {
            rateLimit: readRateLimit
        },
        schema: {
            params: {
                type: "object",
                properties: {
                    id: { type: "string", pattern: ID_PATTERN }
                },
                required: ["id"]
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;

        try {
            //request shout data
            const res = await query(
                `SELECT message, iv, salt, expires FROM messages WHERE id = $1`,
                [id]
            );

            //404 if shout is not found
            if (res.rowCount === 0) {
                return reply.code(404).type("text/html").sendFile("404.html");
            }

            const msg = res.rows[0];

            //delete and 410 if shout is expired
            if (msg.expires && msg.expires < Date.now()) {
                await deleteMessage(fastify, id);
                return reply.code(410).type("text/html").sendFile("404.html");
            }

            return reply.sendFile("view.html");
        } catch (err) {
            fastify.log.error({ err, id }, "Failed to retrieve message");
            return reply.code(500).send(
                errorResponse(500, "Server error")
            );
        }
    });

    //GET /shout/:id/data - return shout data in json
    fastify.get("/api/shout/:id/data", {
        config: {
            rateLimit: readRateLimit
        },
        schema: {
            params: {
                type: "object",
                properties: {
                    id: { type: "string", pattern: ID_PATTERN }
                },
                required: ["id"]
            },
            response: {
                200: {
                    type: "object",
                    properties: {
                        message: { type: "string" },
                        iv: { type: "string" },
                        id: { type: "string" },
                        salt: { type: "string" }
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;

        try {
            //request shout data with FOR UPDATE lock
            const res = await query(
                `SELECT message, iv, salt, expires 
                 FROM messages 
                 WHERE id = $1 
                 FOR UPDATE`,
                [id]
            );

            //404 if shout is not found
            if (res.rowCount === 0) {
                return reply.code(404).send(
                    errorResponse(404, "Message not found")
                );
            }

            const msg = res.rows[0];

            //delete and 410 if shout is expired
            if (msg.expires && msg.expires < Date.now()) {
                await deleteMessage(fastify, id);
                return reply.code(410).send(
                    errorResponse(410, "Message expired")
                );
            }

            // Delete after reading if not already deleted
            await deleteMessage(fastify, id);

            return {
                message: escapeHtml(msg.message),
                iv: escapeHtml(msg.iv),
                id: escapeHtml(id),
                salt: msg.salt ? escapeHtml(msg.salt) : ""
            };
        } catch (err) {
            fastify.log.error({ err, id }, "Failed to retrieve message data");
            return reply.code(500).send(
                errorResponse(500, "Server error")
            );
        }
    });

    //DELETE /shout/:id
    fastify.delete("/api/shout/:id", {
        config: {
            rateLimit: readRateLimit
        },
        schema: {
            params: {
                type: "object",
                properties: {
                    id: { type: "string", pattern: ID_PATTERN }
                },
                required: ["id"]
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;

        try {
            const deleted = await deleteMessage(fastify, id);
            if (!deleted) {
                return reply.status(500).send(
                    errorResponse(500, "Failed to delete message")
                );
            }
            return reply.status(204).send();
        } catch (err) {
            fastify.log.error({ err, id }, "Failed to delete message");
            return reply.status(500).send(
                errorResponse(500, "Failed to delete message")
            );
        }
    });
}

import { randomUUID, timingSafeEqual } from "crypto";
import { Buffer } from "buffer";
import { query } from "../db/db.js";

const MAX_MESSAGE_SIZE = 8000;
const MIN_MESSAGE_SIZE = 1;
const IV_PATTERN = "^[A-Za-z0-9_-]{16,24}$";
const SALT_PATTERN = "^[A-Za-z0-9_-]{16,64}$";
const ID_PATTERN = "^[A-Za-z0-9_-]{22}$";
const MESSAGE_EXPIRY = 24 * 60 * 60 * 1000;
const DELETE_TOKEN_LENGTH = 32;

//rate limit configurations with more restrictive limits
const createRateLimit = {
    max: 5,
    timeWindow: '1 minute',
    errorMessage: 'Too many messages created. Please try again later.'
};

const readRateLimit = {
    max: 20,
    timeWindow: '1 minute',
    errorMessage: 'Too many message requests. Please try again later.'
};

//enhanced security helpers
function generateDeleteToken() {
    return Buffer.from(randomUUID() + randomUUID()).toString('base64url').slice(0, DELETE_TOKEN_LENGTH);
}

function uuidToBase64url(uuid) {
    const hex = uuid.replace(/-/g, "");
    const buffer = Buffer.from(hex, "hex");
    return buffer.toString("base64url").replace(/=+$/, "");
}

async function secureDelete(fastify, id, deleteToken) {
    try {
        const result = await query(
            `DELETE FROM messages WHERE id = $1 AND delete_token = $2 RETURNING id`,
            [id, deleteToken]
        );
        const deleted = result.rowCount > 0;
        if (deleted) {
            fastify.log.info(`🗑️ Deleted message: ${id}`);
        }
        return deleted;
    } catch (err) {
        fastify.log.error({ err, id }, "Failed to delete message");
        return false;
    }
}

//error response helper with constant time responses
async function errorResponse(statusCode, message, details = null) {
    //add artificial delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
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
                        maxLength: MAX_MESSAGE_SIZE,
                        pattern: "^[A-Za-z0-9+/=_-]+$" // Base64 content only
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
            }
        }
    }, async (request, reply) => {
        const { message, iv, salt } = request.body;

        try {
            const id = uuidToBase64url(randomUUID());
            const deleteToken = generateDeleteToken();
            const expires = Date.now() + MESSAGE_EXPIRY;

            await query(
                `INSERT INTO messages (id, message, iv, salt, delete_token, expires) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [id, message, iv, salt || null, deleteToken, expires]
            );

            fastify.log.info({ id, messageLength: message.length }, "Message created");
            return { 
                id, 
                url: `/shout/${id}`,
                deleteToken //return delete token to client
            };
        } catch (err) {
            fastify.log.error(err, "Failed to create message");
            return reply.status(500).send(
                await errorResponse(500, "Failed to create message")
            );
        }
    });

    // GET /shout/:id - serve the view page
    fastify.get("/shout/:id", {
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
        return reply.sendFile("view.html");
    });

    //GET /shout/:id/data
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
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;

        try {
            const res = await query(
                `SELECT message, iv, salt, expires, delete_token FROM messages WHERE id = $1`,
                [id]
            );

            //constant time response for both found and not found cases
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

            if (res.rowCount === 0) {
                return reply.status(404).send(
                    await errorResponse(404, "Message not found")
                );
            }

            const msg = res.rows[0];

            if (msg.expires && msg.expires < Date.now()) {
                await secureDelete(fastify, id, msg.delete_token);
                return reply.status(410).send(
                    await errorResponse(410, "Message expired")
                );
            }

            return {
                id,
                message: msg.message,
                iv: msg.iv,
                salt: msg.salt,
                deleteToken: msg.delete_token
            };
        } catch (err) {
            fastify.log.error(err, "Failed to retrieve message");
            return reply.status(500).send(
                await errorResponse(500, "Server error")
            );
        }
    });

    // DELETE /shout/:id
    fastify.delete("/api/shout/:id", {
        schema: {
            params: {
                type: "object",
                properties: {
                    id: { type: "string", pattern: ID_PATTERN }
                },
                required: ["id"]
            },
            headers: {
                type: "object",
                required: ["x-delete-token"],
                properties: {
                    "x-delete-token": { 
                        type: "string",
                        minLength: DELETE_TOKEN_LENGTH,
                        maxLength: DELETE_TOKEN_LENGTH
                    }
                }
            }
        }
    }, async (request, reply) => {
        const { id } = request.params;
        const deleteToken = request.headers["x-delete-token"];

        const deleted = await secureDelete(fastify, id, deleteToken);
        
        //constant time response
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        if (!deleted) {
            return reply.status(404).send(
                await errorResponse(404, "Message not found or invalid delete token")
            );
        }

        return { success: true };
    });
}

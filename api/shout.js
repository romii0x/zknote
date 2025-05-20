import { randomUUID } from "crypto";
import { query } from "../db.js";

export default async function shoutPlugin(fastify) {

  //POST message to /api/shout
  fastify.post("/api/shout", async (request, reply) => {
    const { message, passphrase } = request.body;

    if (!message || typeof message !== "string" || message.length > 5000) {
      return reply.status(400).send({ error: "Invalid message" });
    }

    const id = randomUUID().slice(0, 8);
    const expires = Date.now() + 24 * 60 * 60 * 1000;

    try {
      await query(
        `INSERT INTO messages (id, message, passphrase, expires) VALUES ($1, $2, $3, $4)`,
        [id, message, passphrase || "", expires]
      );
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Database insert failed" });
    }

    return { id, url: `/shout/${id}` };
  });

  //GET message at /shout/:id
  fastify.get("/shout/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      //find message in db
      const res = await query(
        `SELECT message, expires FROM messages WHERE id = $1`,
        [id]
      );

      if (res.rowCount === 0) {
        return reply.status(404).type("text/html").send("<h2>Not found or expired</h2>");
      }

      const msg = res.rows[0];

      //check if expired
      if (msg.expires < Date.now()) {
        //delete
        await query(`DELETE FROM messages WHERE id = $1`, [id]);
        return reply.status(404).type("text/html").send("<h2>Not found or expired</h2>");
      }

      //self destruct
      await query(`DELETE FROM messages WHERE id = $1`, [id]);

      return reply.type("text/html").send(`<pre>${msg.message}</pre>`);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).type("text/html").send("<h2>Server error</h2>");
    }
  });
}

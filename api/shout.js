//imports and declarations
import Fastify from "fastify";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

const fastify = Fastify({ logger: true });
//messages stored in json format
const DATA_FILE = path.resolve("./data/messages.json");

let messages = {};



//load messages on startup
async function loadMessages() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    messages = JSON.parse(data);
  } catch {
    messages = {};
  }
}

//save messages to file
async function saveMessages() {
  await fs.writeFile(DATA_FILE, JSON.stringify(messages, null, 2));
}

//clean old messages
function cleanExpired() {
  const now = Date.now();
  for (const [id, msg] of Object.entries(messages)) {
    if (msg.expires < now) {
      delete messages[id];
    }
  }
}

await loadMessages();
cleanExpired();

fastify.post("/api/shout", async (request, reply) => {
  const { message, passphrase } = request.body;
  if (!message || typeof message !== "string" || message.length > 5000) {
    return reply.status(400).send({ error: "Invalid message" });
  }

  const id = randomUUID().slice(0, 8);
  const expires = Date.now() + 24 * 60 * 60 * 1000; //hardcoded to 24hr expiry

  messages[id] = { message, passphrase, expires };
  await saveMessages();

  return { id, url: `/shout/${id}` };
});

fastify.get("/api/shout/:id", async (request, reply) => {
  const { id } = request.params;
  const msg = messages[id];

  if (!msg) return reply.status(404).send({ error: "Not found or expired" });

//no passphrase validation here; should be added in future
  delete messages[id];
  await saveMessages();

  return { message: msg.message };
});

//export handler for vercel
export default fastify;

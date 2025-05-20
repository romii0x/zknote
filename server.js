import Fastify from "fastify";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "@fastify/static";
import dotenv from "dotenv";
import shoutPlugin from "./api/shout.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

fastify.get("/", (req, reply) => {
  reply.sendFile("index.html");
});

fastify.register(shoutPlugin);

const port = process.env.PORT || 3000;

fastify.listen({ port }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 ShoutBin running at ${address}`);
});

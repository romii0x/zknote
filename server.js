import Fastify from "fastify";
import path from "path";
import { fileURLToPath } from "url";
import fastifyStatic from "fastify-static";
import shoutApi from "./api/shout.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

//serve frontend
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/", 
});

//register api at /api
fastify.register(shoutApi, { prefix: "/api" });

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log("🚀 Server running at http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

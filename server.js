import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import shoutPlugin from "./api/shout.js";



dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

//helmet with CSP
await fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    }
  }
});

//rate limiting (basic logic for now)
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  ban: 1,
});


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

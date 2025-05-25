import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

import shoutPlugin from "./api/shout.js";
import cron from 'node-cron';
import { deleteExpiredMessages } from './jobs/cleanup.js';



dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
    logger: true,
    trustProxy: true
});

//CSP
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
    },
    hsts: {
        maxAge: 31536000, //1 year
        includeSubDomains: true,
        preload: true
    },
    referrerPolicy: { policy: 'no-referrer' },
    permissionsPolicy: {
        features: {
            geolocation: ['none'],
            camera: ['none'],
            microphone: ['none']
        }
    }
});

//rate limiting (basic logic for now)
await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    ban: 1,
});


//register routes and plugins
fastify.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/",
});

fastify.get("/", (req, reply) => {
    reply.sendFile("index.html");
});

fastify.register(shoutPlugin);

//404 handler
fastify.setNotFoundHandler((request, reply) => {
    return reply.code(404).type("text/html").sendFile("404.html");
});

//schedule cleanup every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await deleteExpiredMessages(fastify);
    console.log('🧹 Cleanup job ran at', new Date());
  } catch (err) {
    console.error('Cleanup job failed:', err);
  }
});

//start the server
const port = process.env.PORT || 3000;

fastify.listen({ port }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log(`🚀 ShoutBin running at ${address}`);
});

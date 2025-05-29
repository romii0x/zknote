import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from 'node-cron';

import shoutPlugin from "./api/shout.js";
import { deleteExpiredMessages } from './jobs/cleanup.js';
import { setupDatabase } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        serializers: {
            err: (err) => {
                return {
                    type: err.type,
                    message: err.message,
                    stack: err.stack
                };
            }
        }
    },
    trustProxy: true
});

// Make fastify instance globally available for legacy code
global.fastify = fastify;

// Setup database first
await setupDatabase(fastify);

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
fastify.register(shoutPlugin);

fastify.get("/", (req, reply) => {
    reply.sendFile("app.html");
});

fastify.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/",
});

//404 handler
fastify.setNotFoundHandler((req, reply) => {
    return reply.code(404).type("text/html").sendFile("404.html");
});

//schedule cleanup job with better error handling and logging
let cleanupJob;
function setupCleanupJob() {
    if (cleanupJob) {
        cleanupJob.stop();
    }

    cleanupJob = cron.schedule('*/5 * * * *', async () => {
        try {
            const metrics = await deleteExpiredMessages(fastify);
            if (!metrics.success) {
                fastify.log.warn('Cleanup job completed with warnings', metrics);
            }
        } catch (err) {
            fastify.log.error('Cleanup job failed critically:', err);
            
            //attempt to recover by resetting the job
            cleanupJob.stop();
            setTimeout(setupCleanupJob, 60000); //try again in 1 minute
        }
    }, {
        scheduled: true,
        timezone: "UTC"
    });
}

//start the cleanup job
setupCleanupJob();

//shutdown cleanup job
function gracefulShutdown() {
    if (cleanupJob) {
        cleanupJob.stop();
    }
    fastify.close(() => {
        process.exit(0);
    });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

//start the server
const port = process.env.PORT || 3000;

fastify.listen({ port }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log(`🚀 ShoutBin running at ${address}`);
});

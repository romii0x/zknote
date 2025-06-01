import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from 'node-cron';

import shoutPlugin from "./api/shout.js";
import { deleteExpiredMessages } from './jobs/cleanup.js';
import { setupDatabase } from './db/db.js';

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
    trustProxy: true,
    bodyLimit: 153600 //150kb
});

//make fastify instance globally available for legacy code
global.fastify = fastify;

//setup database first
await setupDatabase(fastify);

//CSP
await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            baseUri: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            manifestSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true,
    permissionsPolicy: {
        features: {
            accelerometer: ['none'],
            ambientLightSensor: ['none'],
            autoplay: ['none'],
            battery: ['none'],
            camera: ['none'],
            displayCapture: ['none'],
            document: ['none'],
            executionWhileOutOfViewport: ['none'],
            fullscreen: ['none'],
            geolocation: ['none'],
            gyroscope: ['none'],
            magnetometer: ['none'],
            microphone: ['none'],
            midi: ['none'],
            payment: ['none'],
            pictureInPicture: ['none'],
            usb: ['none'],
            wakeLock: ['none'],
            xr: ['none']
        }
    }
});

//add CORS configuration
await fastify.register(fastifyCors, {
    origin: false, //disable CORS by default
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-delete-token'],
    credentials: false,
    maxAge: 86400, // 24 hours
    exposedHeaders: [], //no headers exposed to clients
    preflight: false //disable preflight caching
});

//improved rate limiting 
await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    allowList: ['127.0.0.1'],
    ban: 3,
    banTimeMs: 60 * 60 * 1000, //1 hour ban
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || req.ip;
    },
    skipOnError: false,
    addHeaders: {
        remaining: true,
        reset: true,
        total: true
    }
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

fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    console.log(`🚀 ShoutBin running at ${address}`);
});

/**
 * LoopBridge — Express Server Entry Point
 *
 * Serves the static frontend AND the JSON API.
 *
 * Architecture:
 *   config/          — centralised env-driven config
 *   repositories/    — pure data-access (SQLite now, swap for RDS/DynamoDB)
 *   services/        — business logic (no HTTP concepts)
 *   routes/          — thin Express controllers
 *   middleware/      — auth session, guards
 *
 * The `app` is exported separately from `listen()` so it can be:
 *   • wrapped by @vendia/serverless-express for AWS Lambda
 *   • imported in integration tests without starting a port
 *
 * Usage:
 *   cd server && npm start        (production)
 *   cd server && npm run dev      (watch mode)
 *   cd server && npm run seed     (populate DB from JSON files)
 */
'use strict';

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { initTables } = require('./db');
const { sessionMiddleware } = require('./middleware/auth');
const { storageService } = require('./services');

// Route modules
const authRoutes = require('./routes/auth');
const articleRoutes = require('./routes/articles');
const courseRoutes = require('./routes/courses');
const uploadRoutes = require('./routes/uploads');
const miscRoutes = require('./routes/misc');
const dashboardRoutes = require('./routes/dashboard');
const analyticsRoutes = require('./routes/analytics');

// ─── Create Express App ─────────────────────────────────
const app = express();

// ─── Security Headers ───────────────────────────────────
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.nodeEnv === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// ─── Rate Limiting (in-memory, simple) ──────────────────
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_GENERAL = 120;     // 120 req/min general
const RATE_MAX_AUTH = 10;         // 10 req/min for login

function rateLimit(windowMs, max) {
    return (req, res, next) => {
        const key = (req.ip || 'unknown') + ':' + req.baseUrl;
        const now = Date.now();
        const record = rateLimitMap.get(key);
        if (!record || now - record.start > windowMs) {
            rateLimitMap.set(key, { start: now, count: 1 });
            return next();
        }
        record.count++;
        if (record.count > max) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        next();
    };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap) {
        if (now - record.start > RATE_WINDOW_MS * 2) rateLimitMap.delete(key);
    }
}, 5 * 60 * 1000).unref();

// ─── Middleware ──────────────────────────────────────────
app.use(cors({
    origin: config.corsOrigin,
    credentials: true
}));
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(cookieParser());
app.use(sessionMiddleware);

// ─── API Routes ─────────────────────────────────────────
app.use('/api/auth', rateLimit(RATE_WINDOW_MS, RATE_MAX_AUTH), authRoutes);
app.use('/api/articles', rateLimit(RATE_WINDOW_MS, RATE_MAX_GENERAL), articleRoutes);
app.use('/api/courses', rateLimit(RATE_WINDOW_MS, RATE_MAX_GENERAL), courseRoutes);
app.use('/api/uploads', rateLimit(RATE_WINDOW_MS, RATE_MAX_GENERAL), uploadRoutes);
app.use('/api/dashboard', rateLimit(RATE_WINDOW_MS, RATE_MAX_GENERAL), dashboardRoutes);
app.use('/api/analytics', rateLimit(RATE_WINDOW_MS, RATE_MAX_GENERAL), analyticsRoutes);
app.use('/api', miscRoutes);

// ─── Uploaded files (served at /uploads/*) ──────────────
app.use('/uploads', express.static(config.uploadsDir));

// ─── Static Files (React SPA from client/dist) ─────────
app.use(express.static(config.staticRoot, {
    index: 'index.html'
}));

// SPA-style fallback (only for non-API, non-file requests)
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(require('path').join(config.staticRoot, 'index.html'));
});

// ─── Error Handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('[server]', err);
    res.status(500).json({ error: 'Internal server error.' });
});

// ─── Export app for Lambda / tests ──────────────────────
module.exports = { app, bootstrap };

// ─── Async bootstrap (DB init + storage) ────────────────
async function bootstrap() {
    await initTables();
    storageService.init();
}

// ─── Start (only when run directly, not when imported) ──
if (require.main === module) {
    bootstrap().then(() => {
        const server = app.listen(config.port, () => {
            console.log(`[LoopBridge] Server running on http://localhost:${config.port}`);
            console.log(`[LoopBridge] Environment: ${config.nodeEnv}`);
            console.log(`[LoopBridge] Storage driver: ${config.storageDriver}`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`[LoopBridge] Port ${config.port} is already in use.`);
                console.error(`  Kill the existing process:  lsof -ti:${config.port} | xargs kill -9`);
                console.error(`  Or use a different port:    PORT=3001 npm start`);
                process.exit(1);
            }
            throw err;
        });

        // Graceful shutdown
        const shutdown = (signal) => {
            console.log(`\n[LoopBridge] Received ${signal}. Shutting down...`);
            server.close(() => {
                console.log('[LoopBridge] Server closed.');
                process.exit(0);
            });
            setTimeout(() => {
                console.error('[LoopBridge] Forced shutdown after timeout.');
                process.exit(1);
            }, 5000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }).catch(err => {
        console.error('[LoopBridge] Bootstrap failed:', err);
        process.exit(1);
    });
}

/**
 * LoopBridge — Rate Limiting Middleware
 *
 * In-memory, per-process, per-IP+route rate limiter. Correct for the
 * current deployment topology: a single app instance/container
 * (see infrastructure/terraform/ec2.tf, docker-compose.prod.yml).
 *
 * Scaling note: if the app is ever split across multiple instances/processes
 * (docker-compose.prod.yml's documented "ALB + ECS Fargate" step), this
 * per-process Map stops being accurate — each instance enforces its own
 * limit. At that point, swap `store` below for a shared store (e.g. Redis
 * via `rate-limit-redis`). The store interface (`increment(key, windowMs)`)
 * is intentionally tiny so that swap is a single-file change — no call
 * sites in index.js need to change.
 */
'use strict';

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_GENERAL = 120;     // 120 req/min general
const MAX_AUTH = 10;         // 10 req/min for login/auth

// ─── Store (per-process Map) ────────────────────────────
function createMapStore() {
    const map = new Map();

    // Clean up stale entries every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of map) {
            if (now - record.start > WINDOW_MS * 2) map.delete(key);
        }
    }, 5 * 60 * 1000).unref();

    return {
        /** Increment the counter for `key`, resetting it if `windowMs` has elapsed. Returns the new count. */
        increment(key, windowMs) {
            const now = Date.now();
            const record = map.get(key);
            if (!record || now - record.start > windowMs) {
                map.set(key, { start: now, count: 1 });
                return 1;
            }
            record.count++;
            return record.count;
        },
    };
}

const store = createMapStore();

function rateLimit(windowMs, max) {
    return (req, res, next) => {
        const key = (req.ip || 'unknown') + ':' + req.baseUrl;
        const count = store.increment(key, windowMs);
        if (count > max) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        next();
    };
}

module.exports = { rateLimit, WINDOW_MS, MAX_GENERAL, MAX_AUTH };

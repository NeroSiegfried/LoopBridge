/**
 * LoopBridge — Centralised Configuration
 *
 * All environment-driven config in one place.
 * Reads from process.env with sensible defaults for local dev.
 *
 * When deploying to AWS, set the corresponding environment variables
 * (e.g. via Parameter Store, Secrets Manager, or Lambda env vars).
 */
'use strict';

const path = require('path');

const config = {
    // ─── Server ──────────────────────────────────────────
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // ─── Database ────────────────────────────────────────
    // Local: SQLite file path
    // AWS:   Set DB_TYPE=pg and provide DATABASE_URL for RDS/Aurora
    dbType: process.env.DB_TYPE || 'sqlite',
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'loopbridge.db'),
    databaseUrl: process.env.DATABASE_URL || null,

    // ─── Auth / Sessions ─────────────────────────────────
    sessionTtlMs: parseInt(process.env.SESSION_TTL_MS, 10) || 7 * 24 * 60 * 60 * 1000,
    cookieName: process.env.COOKIE_NAME || 'lb_session',
    cookieSecure: process.env.COOKIE_SECURE === 'true',          // true behind HTTPS/ALB
    cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',

    // ─── File Storage ────────────────────────────────────
    // Local: 'disk'  |  AWS: 's3'
    storageDriver: process.env.STORAGE_DRIVER || 'disk',
    uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'),
    s3Bucket: process.env.S3_BUCKET || null,
    s3Region: process.env.S3_REGION || 'us-east-1',
    s3Prefix: process.env.S3_PREFIX || 'uploads/',
    cdnBaseUrl: process.env.CDN_BASE_URL || null,                // CloudFront distribution URL

    // ─── CORS ────────────────────────────────────────────
    corsOrigin: process.env.CORS_ORIGIN || true,                 // true = reflect

    // ─── Static Data ─────────────────────────────────────
    dataDir: process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'),

    // ─── Static Frontend (only used in monolith mode) ────
    staticRoot: process.env.STATIC_ROOT || path.join(__dirname, '..', '..'),

    // ─── Upload Limits ───────────────────────────────────
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 50 * 1024 * 1024,
    maxFiles: parseInt(process.env.MAX_FILES, 10) || 10,
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || '50mb',
};

module.exports = config;

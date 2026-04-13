/**
 * LoopBridge — Database Layer (dual-driver: SQLite + PostgreSQL)
 *
 * When DB_TYPE=sqlite (default):  uses better-sqlite3  (sync)
 * When DB_TYPE=pg:                uses pg Pool          (async)
 *
 * Exports a unified **async** adapter so every repository can call:
 *   db.query(sql, params)           → { rows }
 *   db.queryRow(sql, params)        → row | null
 *   db.run(sql, params)             → { changes, lastInsertRowid }
 *   db.runNamed(sql, namedObj)      → same, with @key placeholders
 *   db.queryNamed(sql, namedObj)    → { rows }
 *   db.queryRowNamed(sql, namedObj) → row | null
 *   db.exec(sql)                    → void
 *
 * All methods return Promises for consistency. SQLite methods resolve
 * synchronously but are wrapped so callers always use `await`.
 */
'use strict';

const config = require('./config');

/* ================================================================
   SQLite DRIVER (wraps sync better-sqlite3 in async interface)
   ================================================================ */
function createSqliteDriver() {
    const Database = require('better-sqlite3');
    const path = require('path');

    const DB_PATH = config.dbPath || path.join(__dirname, 'loopbridge.db');
    let _db;

    function raw() {
        if (!_db) {
            _db = new Database(DB_PATH);
            _db.pragma('journal_mode = WAL');
            _db.pragma('foreign_keys = ON');
        }
        return _db;
    }

    return {
        type: 'sqlite',

        async query(sql, params = []) {
            return { rows: raw().prepare(sql).all(...params) };
        },
        async queryRow(sql, params = []) {
            return raw().prepare(sql).get(...params) || null;
        },
        async run(sql, params = []) {
            const info = raw().prepare(sql).run(...params);
            return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
        },
        async runNamed(sql, params = {}) {
            const info = raw().prepare(sql).run(params);
            return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
        },
        async queryNamed(sql, params = {}) {
            return { rows: raw().prepare(sql).all(params) };
        },
        async queryRowNamed(sql, params = {}) {
            return raw().prepare(sql).get(params) || null;
        },
        async exec(sql) {
            raw().exec(sql);
        },
        transaction(fn) {
            // better-sqlite3 transaction returns a sync function
            return raw().transaction(fn);
        },
        raw,
    };
}

/* ================================================================
   PostgreSQL DRIVER
   ================================================================ */
function createPgDriver() {
    const { Pool } = require('pg');

    // Strip sslmode from the connection string — we control SSL via the
    // ssl object below so the pg library doesn't override rejectUnauthorized.
    const connStr = (config.databaseUrl || '').replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');

    const pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
    });

    pool.on('error', (err) => {
        console.error('[db] Unexpected PG pool error:', err.message);
    });

    /** Convert @named placeholders → $1,$2,… and return ordered values */
    function convertNamed(sql, params) {
        const keys = [];
        let idx = 0;
        const converted = sql.replace(/@(\w+)/g, (_, key) => {
            keys.push(key);
            idx++;
            return `$${idx}`;
        });
        return { sql: converted, values: keys.map(k => params[k]) };
    }

    /** Convert positional `?` → $1,$2,… */
    function convertPositional(sql, params) {
        let idx = 0;
        const converted = sql.replace(/\?/g, () => { idx++; return `$${idx}`; });
        return { sql: converted, values: Array.isArray(params) ? params : [] };
    }

    /** Normalise SQLite-isms → PostgreSQL equivalents */
    function normaliseSql(sql) {
        let out = sql
            .replace(/datetime\('now'\)/gi, 'NOW()')
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

        // INSERT OR REPLACE → INSERT … ON CONFLICT (id) DO UPDATE SET …
        if (/\bINSERT OR REPLACE\b/i.test(out)) {
            out = out.replace(/\bINSERT OR REPLACE\b/gi, 'INSERT');
            // Parse column list from INSERT INTO table (col1, col2, …)
            const colMatch = out.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
            if (colMatch && !/ON CONFLICT/i.test(out)) {
                const cols = colMatch[1].split(',').map(c => c.trim());
                // First column is always the PK (id) for our tables
                const pk = cols[0];
                const updateCols = cols.slice(1);
                const setClauses = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');
                // Append after the VALUES clause (handles both positional and named)
                out = out.replace(/(VALUES\s*\([^)]*\))/i,
                    `$1 ON CONFLICT (${pk}) DO UPDATE SET ${setClauses}`);
            }
        }

        // INSERT OR IGNORE → INSERT … ON CONFLICT DO NOTHING
        if (/\bINSERT OR IGNORE\b/i.test(out)) {
            out = out.replace(/\bINSERT OR IGNORE\b/gi, 'INSERT');
            if (!/ON CONFLICT/i.test(out)) {
                out = out.replace(/(VALUES\s*\([^)]*\))/i, '$1 ON CONFLICT DO NOTHING');
            }
        }

        return out;
    }

    function preparePositional(sql, params) {
        return convertPositional(normaliseSql(sql), params);
    }
    function prepareNamed(sql, params) {
        return convertNamed(normaliseSql(sql), params);
    }

    return {
        type: 'pg',

        async query(sql, params = []) {
            const p = preparePositional(sql, params);
            const result = await pool.query(p.sql, p.values);
            return { rows: result.rows };
        },
        async queryRow(sql, params = []) {
            const p = preparePositional(sql, params);
            const result = await pool.query(p.sql, p.values);
            return result.rows[0] || null;
        },
        async run(sql, params = []) {
            const p = preparePositional(sql, params);
            const result = await pool.query(p.sql, p.values);
            return { changes: result.rowCount, lastInsertRowid: result.rows?.[0]?.id ?? null };
        },
        async runNamed(sql, params = {}) {
            const p = prepareNamed(sql, params);
            const result = await pool.query(p.sql, p.values);
            return { changes: result.rowCount, lastInsertRowid: result.rows?.[0]?.id ?? null };
        },
        async queryNamed(sql, params = {}) {
            const p = prepareNamed(sql, params);
            const result = await pool.query(p.sql, p.values);
            return { rows: result.rows };
        },
        async queryRowNamed(sql, params = {}) {
            const p = prepareNamed(sql, params);
            const result = await pool.query(p.sql, p.values);
            return result.rows[0] || null;
        },
        async exec(sql) {
            await pool.query(normaliseSql(sql));
        },
        transaction(fn) {
            return async (...args) => {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await fn(...args);
                    await client.query('COMMIT');
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                } finally {
                    client.release();
                }
            };
        },
        raw() { return pool; },
        async close() { await pool.end(); },
    };
}


/* ================================================================
   SCHEMA DDL
   ================================================================ */
const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    email         TEXT UNIQUE NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','author','user')),
    avatar        TEXT,
    author_of     TEXT DEFAULT '[]',
    google_id     TEXT,
    phone         TEXT,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    slug         TEXT,
    description  TEXT,
    category     TEXT,
    image        TEXT,
    author_name  TEXT,
    author_avatar TEXT,
    read_time    TEXT,
    published_at TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    featured     INTEGER NOT NULL DEFAULT 0,
    deleted      INTEGER NOT NULL DEFAULT 0,
    deleted_at   TEXT,
    content      TEXT DEFAULT '[]',
    views        INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS courses (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    slug         TEXT,
    description  TEXT,
    image        TEXT,
    author_name  TEXT,
    author_avatar TEXT,
    duration     TEXT,
    level        TEXT,
    track        TEXT,
    price        REAL NOT NULL DEFAULT 0,
    published_at TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved     INTEGER NOT NULL DEFAULT 1,
    deleted      INTEGER NOT NULL DEFAULT 0,
    deleted_at   TEXT,
    topics       TEXT DEFAULT '[]',
    overview     TEXT,
    learning_objectives TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS faqs (
    id       TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer   TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS progress (
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id        TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_subs   TEXT DEFAULT '[]',
    PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS uploads (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size        INTEGER NOT NULL DEFAULT 0,
    path        TEXT NOT NULL,
    url         TEXT NOT NULL,
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS analytics_events (
    id           SERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL,
    user_id      TEXT,
    event_type   TEXT NOT NULL,
    page         TEXT,
    target       TEXT,
    course_id    TEXT,
    article_id   TEXT,
    quiz_id      TEXT,
    score        REAL,
    duration_ms  INTEGER,
    metadata     TEXT DEFAULT '{}',
    ip           TEXT,
    user_agent   TEXT,
    referrer     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analytics_user    ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type    ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_page    ON analytics_events(page);
CREATE INDEX IF NOT EXISTS idx_analytics_date    ON analytics_events(created_at);
CREATE TABLE IF NOT EXISTS otp_codes (
    id         SERIAL PRIMARY KEY,
    phone      TEXT NOT NULL,
    code       TEXT NOT NULL,
    channel    TEXT NOT NULL DEFAULT 'email',
    expires_at TIMESTAMPTZ NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE TABLE IF NOT EXISTS subscribers (
    id            SERIAL PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    source        TEXT DEFAULT 'newsletter',
    active        INTEGER NOT NULL DEFAULT 1,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
`;

const SQLITE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL DEFAULT '',
        email         TEXT UNIQUE NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','author','user')),
        avatar        TEXT,
        author_of     TEXT DEFAULT '[]',
        google_id     TEXT,
        phone         TEXT,
        phone_verified INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS articles (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        slug         TEXT,
        description  TEXT,
        category     TEXT,
        image        TEXT,
        author_name  TEXT,
        author_avatar TEXT,
        read_time    TEXT,
        published_at TEXT,
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        featured     INTEGER NOT NULL DEFAULT 0,
        deleted      INTEGER NOT NULL DEFAULT 0,
        deleted_at   TEXT,
        content      TEXT DEFAULT '[]',
        views        INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS courses (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        slug         TEXT,
        description  TEXT,
        image        TEXT,
        author_name  TEXT,
        author_avatar TEXT,
        duration     TEXT,
        level        TEXT,
        track        TEXT,
        price        REAL NOT NULL DEFAULT 0,
        published_at TEXT,
        updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        approved     INTEGER NOT NULL DEFAULT 1,
        deleted      INTEGER NOT NULL DEFAULT 0,
        deleted_at   TEXT,
        topics       TEXT DEFAULT '[]',
        overview     TEXT,
        learning_objectives TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS faqs (
        id       TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        question TEXT NOT NULL,
        answer   TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS progress (
        user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id        TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        enrolled_at      TEXT NOT NULL DEFAULT (datetime('now')),
        last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_subs   TEXT DEFAULT '[]',
        PRIMARY KEY (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS uploads (
        id          TEXT PRIMARY KEY,
        filename    TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type   TEXT NOT NULL,
        size        INTEGER NOT NULL DEFAULT 0,
        path        TEXT NOT NULL,
        url         TEXT NOT NULL,
        uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS analytics_events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id   TEXT NOT NULL,
        user_id      TEXT,
        event_type   TEXT NOT NULL,
        page         TEXT,
        target       TEXT,
        course_id    TEXT,
        article_id   TEXT,
        quiz_id      TEXT,
        score        REAL,
        duration_ms  INTEGER,
        metadata     TEXT DEFAULT '{}',
        ip           TEXT,
        user_agent   TEXT,
        referrer     TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_user    ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_type    ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_page    ON analytics_events(page);
    CREATE INDEX IF NOT EXISTS idx_analytics_date    ON analytics_events(created_at);
    CREATE TABLE IF NOT EXISTS otp_codes (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT NOT NULL,
        code       TEXT NOT NULL,
        channel    TEXT NOT NULL DEFAULT 'email',
        expires_at TEXT NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
    CREATE TABLE IF NOT EXISTS subscribers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT UNIQUE NOT NULL,
        source        TEXT DEFAULT 'newsletter',
        active        INTEGER NOT NULL DEFAULT 1,
        subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
        unsubscribed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
`;

/* ================================================================
   INIT + EXPORTS
   ================================================================ */
const isPg = config.dbType === 'pg';
const db = isPg ? createPgDriver() : createSqliteDriver();

/**
 * Create all tables (async — await it in server bootstrap).
 */
async function initTables() {
    if (isPg) {
        const statements = PG_SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
            await db.exec(stmt);
        }
        console.log('[db] PostgreSQL tables initialised.');
    } else {
        await db.exec(SQLITE_SCHEMA);
        console.log('[db] SQLite tables initialised.');
    }
}

/**
 * Legacy compat — old code that calls getDb() directly.
 * For SQLite, returns the raw better-sqlite3 instance.
 * For PG, returns the db adapter (callers must use async methods).
 */
function getDb() {
    if (!isPg) return db.raw();
    return db;
}

module.exports = { db, getDb, initTables, isPg, DB_PATH: isPg ? null : config.dbPath };

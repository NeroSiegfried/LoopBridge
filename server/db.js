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
            // Let SQLite retry for up to 5s instead of throwing SQLITE_BUSY
            // immediately when another connection (e.g. Litestream, or a
            // concurrent request) holds the write lock.
            _db.pragma('busy_timeout = 5000');
            // NORMAL is safe (and much faster) under WAL: the WAL file itself
            // guarantees consistency, and at most the last commit could be
            // lost on an OS crash (not a process crash).
            _db.pragma('synchronous = NORMAL');
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
    is_root       INTEGER NOT NULL DEFAULT 0,
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
    author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    featured     INTEGER NOT NULL DEFAULT 0,
    hidden       INTEGER NOT NULL DEFAULT 0,
    approved     INTEGER NOT NULL DEFAULT 0,
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
    author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
    approved     INTEGER NOT NULL DEFAULT 0,
    hidden       INTEGER NOT NULL DEFAULT 0,
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
    paid             INTEGER NOT NULL DEFAULT 0,
    payment_id       TEXT,
    PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS payments (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id      TEXT REFERENCES courses(id) ON DELETE SET NULL,
    provider       TEXT NOT NULL,
    reference      TEXT UNIQUE NOT NULL,
    amount         REAL NOT NULL,
    currency       TEXT NOT NULL DEFAULT 'NGN',
    status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed','refunded')),
    provider_data  TEXT DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user    ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_ref     ON payments(reference);
CREATE TABLE IF NOT EXISTS promotion_requests (
    id             TEXT PRIMARY KEY,
    requester_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_role TEXT NOT NULL DEFAULT 'admin',
    status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    note           TEXT,
    reviewed_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hls_url          TEXT,
    thumbnail_url    TEXT,
    transcode_job_id TEXT,
    transcode_status TEXT DEFAULT 'none',
    transcode_error  TEXT,
    video_width      INTEGER,
    video_height     INTEGER
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
CREATE TABLE IF NOT EXISTS messages (
    id           TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT NOT NULL DEFAULT 'system',
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    link         TEXT,
    metadata     TEXT DEFAULT '{}',
    read         INTEGER NOT NULL DEFAULT 0,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read);
CREATE TABLE IF NOT EXISTS profile_change_requests (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field      TEXT NOT NULL,
    new_value  TEXT NOT NULL,
    target     TEXT NOT NULL,
    channel    TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profile_change_user ON profile_change_requests(user_id, created_at DESC);
`;

const SQLITE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL DEFAULT '',
        email         TEXT UNIQUE NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','author','user')),
        is_root       INTEGER NOT NULL DEFAULT 0,
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
        author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
        featured     INTEGER NOT NULL DEFAULT 0,
        hidden       INTEGER NOT NULL DEFAULT 0,
        approved     INTEGER NOT NULL DEFAULT 0,
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
        author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
        approved     INTEGER NOT NULL DEFAULT 0,
        hidden       INTEGER NOT NULL DEFAULT 0,
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
        paid             INTEGER NOT NULL DEFAULT 0,
        payment_id       TEXT,
        PRIMARY KEY (user_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS payments (
        id             TEXT PRIMARY KEY,
        user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id      TEXT REFERENCES courses(id) ON DELETE SET NULL,
        provider       TEXT NOT NULL,
        reference      TEXT UNIQUE NOT NULL,
        amount         REAL NOT NULL,
        currency       TEXT NOT NULL DEFAULT 'NGN',
        status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed','refunded')),
        provider_data  TEXT DEFAULT '{}',
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_ref  ON payments(reference);
    CREATE TABLE IF NOT EXISTS promotion_requests (
        id             TEXT PRIMARY KEY,
        requester_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_role TEXT NOT NULL DEFAULT 'admin',
        status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        note           TEXT,
        reviewed_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at    TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
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
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        hls_url          TEXT,
        thumbnail_url    TEXT,
        transcode_job_id TEXT,
        transcode_status TEXT DEFAULT 'none',
        transcode_error  TEXT,
        video_width      INTEGER,
        video_height     INTEGER
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
    CREATE TABLE IF NOT EXISTS messages (
        id           TEXT PRIMARY KEY,
        recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type         TEXT NOT NULL DEFAULT 'system',
        title        TEXT NOT NULL,
        body         TEXT NOT NULL,
        link         TEXT,
        metadata     TEXT DEFAULT '{}',
        read         INTEGER NOT NULL DEFAULT 0,
        read_at      TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages(recipient_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read);
    CREATE TABLE IF NOT EXISTS profile_change_requests (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        field      TEXT NOT NULL,
        new_value  TEXT NOT NULL,
        target     TEXT NOT NULL,
        channel    TEXT NOT NULL,
        code       TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_profile_change_user ON profile_change_requests(user_id, created_at DESC);
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

    // ── Schema migrations (add columns that may be missing on existing DBs) ──
    await runMigrations();
    // ── Create new tables that may be missing on older DBs ──
    await runTableMigrations();
}

/**
 * Run safe ALTER TABLE migrations for both drivers.
 * Each migration is idempotent: silently skipped if the column already exists.
 */
async function runMigrations() {
    const migrations = [
        { table: 'uploads',   column: 'hls_url',          type: 'TEXT',                          pgType: 'TEXT' },
        { table: 'uploads',   column: 'thumbnail_url',    type: 'TEXT',                          pgType: 'TEXT' },
        { table: 'uploads',   column: 'transcode_job_id', type: 'TEXT',                          pgType: 'TEXT' },
        { table: 'uploads',   column: 'transcode_status', type: "TEXT DEFAULT 'none'",           pgType: "TEXT DEFAULT 'none'" },
        { table: 'uploads',   column: 'transcode_error',  type: 'TEXT',                          pgType: 'TEXT' },
        { table: 'uploads',   column: 'video_width',       type: 'INTEGER',                       pgType: 'INTEGER' },
        { table: 'uploads',   column: 'video_height',      type: 'INTEGER',                       pgType: 'INTEGER' },
        // users
        { table: 'users',     column: 'is_root',          type: 'INTEGER NOT NULL DEFAULT 0',    pgType: 'INTEGER NOT NULL DEFAULT 0' },
        // articles
        { table: 'articles',  column: 'author_id',        type: 'TEXT',                          pgType: 'TEXT' },
        { table: 'articles',  column: 'hidden',           type: 'INTEGER NOT NULL DEFAULT 0',    pgType: 'INTEGER NOT NULL DEFAULT 0' },
        { table: 'articles',  column: 'approved',         type: 'INTEGER NOT NULL DEFAULT 0',    pgType: 'INTEGER NOT NULL DEFAULT 0' },
        // courses
        { table: 'courses',   column: 'author_id',        type: 'TEXT',                          pgType: 'TEXT' },
        { table: 'courses',   column: 'hidden',           type: 'INTEGER NOT NULL DEFAULT 0',    pgType: 'INTEGER NOT NULL DEFAULT 0' },
        // progress
        { table: 'progress',  column: 'paid',             type: 'INTEGER NOT NULL DEFAULT 0',    pgType: 'INTEGER NOT NULL DEFAULT 0' },
        { table: 'progress',  column: 'payment_id',       type: 'TEXT',                          pgType: 'TEXT' },
    ];

    for (const m of migrations) {
        try {
            if (isPg) {
                await db.exec(`ALTER TABLE ${m.table} ADD COLUMN IF NOT EXISTS ${m.column} ${m.pgType}`);
            } else {
                await db.exec(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
            }
            console.log(`[db] migration: added ${m.table}.${m.column}`);
        } catch (err) {
            // SQLite throws "duplicate column name" if column exists — that's fine
            if (err.message && err.message.includes('duplicate column')) continue;
            // PG uses IF NOT EXISTS so should never throw, but guard anyway
            console.error(`[db] migration warning for ${m.table}.${m.column}:`, err.message);
        }
    }
}

/**
 * Create new tables that didn't exist in older DB versions.
 * Uses CREATE TABLE IF NOT EXISTS so always safe to run.
 */
async function runTableMigrations() {
    const pgPayments = `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT REFERENCES courses(id) ON DELETE SET NULL, provider TEXT NOT NULL,
        reference TEXT UNIQUE NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'NGN',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','success','failed','refunded')),
        provider_data TEXT DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const pgPromo = `CREATE TABLE IF NOT EXISTS promotion_requests (
        id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_role TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        note TEXT, reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const sqlitePayments = `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT REFERENCES courses(id) ON DELETE SET NULL, provider TEXT NOT NULL,
        reference TEXT UNIQUE NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'NGN',
        status TEXT NOT NULL DEFAULT 'pending', provider_data TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`;
    const sqlitePromo = `CREATE TABLE IF NOT EXISTS promotion_requests (
        id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_role TEXT NOT NULL DEFAULT 'admin', status TEXT NOT NULL DEFAULT 'pending',
        note TEXT, reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`;
    const pgMessages = `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'system', title TEXT NOT NULL, body TEXT NOT NULL,
        link TEXT, metadata TEXT DEFAULT '{}', read INTEGER NOT NULL DEFAULT 0,
        read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const sqliteMessages = `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'system', title TEXT NOT NULL, body TEXT NOT NULL,
        link TEXT, metadata TEXT DEFAULT '{}', read INTEGER NOT NULL DEFAULT 0,
        read_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`;
    const pgProfileChange = `CREATE TABLE IF NOT EXISTS profile_change_requests (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        field TEXT NOT NULL, new_value TEXT NOT NULL, target TEXT NOT NULL,
        channel TEXT NOT NULL, code TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
        used INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const sqliteProfileChange = `CREATE TABLE IF NOT EXISTS profile_change_requests (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        field TEXT NOT NULL, new_value TEXT NOT NULL, target TEXT NOT NULL,
        channel TEXT NOT NULL, code TEXT NOT NULL, expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`;
    // Audit trail of every payment-provider webhook delivery, independent of
    // whether it could be matched/processed — lets support investigate
    // disputes and lets us replay events without relying on the provider's
    // own retry window.
    const pgWebhookEvents = `CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id TEXT PRIMARY KEY, provider TEXT NOT NULL, reference TEXT,
        status TEXT NOT NULL DEFAULT 'received', payload TEXT NOT NULL, error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const sqliteWebhookEvents = `CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id TEXT PRIMARY KEY, provider TEXT NOT NULL, reference TEXT,
        status TEXT NOT NULL DEFAULT 'received', payload TEXT NOT NULL, error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))`;

    try {
        await db.exec(isPg ? pgPayments : sqlitePayments);
        await db.exec(isPg
            ? `CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)`
            : `CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)`);
        await db.exec(isPg ? pgPromo : sqlitePromo);
        await db.exec(isPg ? pgMessages : sqliteMessages);
        await db.exec('CREATE INDEX IF NOT EXISTS idx_messages_recipient_created ON messages(recipient_id, created_at DESC)');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read)');
        await db.exec(isPg ? pgProfileChange : sqliteProfileChange);
        await db.exec('CREATE INDEX IF NOT EXISTS idx_profile_change_user ON profile_change_requests(user_id, created_at DESC)');
        await db.exec(isPg ? pgWebhookEvents : sqliteWebhookEvents);
        await db.exec('CREATE INDEX IF NOT EXISTS idx_webhook_events_reference ON payment_webhook_events(reference)');
        await db.exec('CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_created ON payment_webhook_events(provider, created_at DESC)');
        console.log('[db] payments + promotion_requests tables ready.');
    } catch (err) {
        console.error('[db] table migration warning:', err.message);
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

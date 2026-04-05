/**
 * LoopBridge — Database Layer (SQLite via better-sqlite3)
 *
 * Tables: users, articles, courses, sessions, faqs, progress
 * All JSON-heavy fields (content, topics, socials, etc.) are stored as TEXT (JSON strings).
 */
'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'loopbridge.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

/**
 * Run all CREATE TABLE statements (idempotent).
 */
function initTables() {
    const conn = getDb();

    conn.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            username      TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name  TEXT NOT NULL DEFAULT '',
            email         TEXT UNIQUE NOT NULL,
            role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','author','user')),
            avatar        TEXT,
            author_of     TEXT DEFAULT '[]',
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
    `);
}

module.exports = { getDb, initTables, DB_PATH };

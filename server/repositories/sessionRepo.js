/**
 * LoopBridge — Session Repository
 *
 * Pure data-access for the sessions table.
 */
'use strict';

const { getDb } = require('../db');

const sessionRepo = {
    create({ id, userId, expiresAt }) {
        getDb().prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
            .run(id, userId, expiresAt);
        return this.findById(id);
    },

    findById(id) {
        return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    },

    /**
     * Find a valid (non-expired) session and join the user row.
     * Returns the merged row or undefined.
     */
    findValidWithUser(sessionId) {
        return getDb().prepare(`
            SELECT s.*, u.id AS uid, u.username, u.display_name, u.email,
                   u.role, u.avatar, u.author_of
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = ? AND s.expires_at > datetime('now')
        `).get(sessionId);
    },

    deleteById(id) {
        getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id);
    },

    deleteExpired() {
        getDb().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
    },

    deleteByUserId(userId) {
        getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }
};

module.exports = sessionRepo;

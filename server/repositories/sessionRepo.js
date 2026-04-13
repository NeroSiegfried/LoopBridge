/**
 * LoopBridge — Session Repository
 *
 * Pure data-access for the sessions table.
 */
'use strict';

const { db } = require('../db');

const sessionRepo = {
    async create({ id, userId, expiresAt }) {
        await db.run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
            [id, userId, expiresAt]);
        return this.findById(id);
    },

    async findById(id) {
        return await db.queryRow('SELECT * FROM sessions WHERE id = ?', [id]);
    },

    /**
     * Find a valid (non-expired) session and join the user row.
     */
    async findValidWithUser(sessionId) {
        return await db.queryRow(`
            SELECT s.*, u.id AS uid, u.username, u.display_name, u.email,
                   u.role, u.avatar, u.author_of
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = ? AND s.expires_at > datetime('now')
        `, [sessionId]);
    },

    async deleteById(id) {
        await db.run('DELETE FROM sessions WHERE id = ?', [id]);
    },

    async deleteExpired() {
        await db.run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
    },

    async deleteByUserId(userId) {
        await db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
    }
};

module.exports = sessionRepo;

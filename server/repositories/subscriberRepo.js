/**
 * LoopBridge — Subscriber Repository (newsletter sign-ups)
 */
'use strict';

const { db } = require('../db');

const subscriberRepo = {
    /**
     * Subscribe an email. If already exists and inactive, reactivate.
     * Returns { id, email, isNew }
     */
    async subscribe(email, source = 'newsletter') {
        const normalised = email.trim().toLowerCase();

        const existing = await db.queryRow('SELECT id, active FROM subscribers WHERE email = ?', [normalised]);

        if (existing) {
            if (!existing.active) {
                await db.run('UPDATE subscribers SET active = 1, unsubscribed_at = NULL, source = ? WHERE id = ?',
                    [source, existing.id]);
            }
            return { id: existing.id, email: normalised, isNew: false };
        }

        const result = await db.run('INSERT INTO subscribers (email, source) VALUES (?, ?)',
            [normalised, source]);

        return { id: result.lastInsertRowid, email: normalised, isNew: true };
    },

    /**
     * Unsubscribe an email (soft-delete).
     */
    async unsubscribe(email) {
        const normalised = email.trim().toLowerCase();
        return await db.run(
            "UPDATE subscribers SET active = 0, unsubscribed_at = datetime('now') WHERE email = ? AND active = 1",
            [normalised]);
    },

    /**
     * Check if email is already subscribed.
     */
    async isSubscribed(email) {
        const normalised = email.trim().toLowerCase();
        const row = await db.queryRow('SELECT id FROM subscribers WHERE email = ? AND active = 1', [normalised]);
        return !!row;
    },

    /**
     * List all active subscribers.
     */
    async listActive() {
        const { rows } = await db.query('SELECT id, email, source, subscribed_at FROM subscribers WHERE active = 1 ORDER BY subscribed_at DESC');
        return rows;
    },

    /**
     * Count active subscribers.
     */
    async countActive() {
        const row = await db.queryRow('SELECT COUNT(*) as count FROM subscribers WHERE active = 1');
        return row.count;
    },
};

module.exports = subscriberRepo;

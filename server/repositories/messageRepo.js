/**
 * LoopBridge — Message Repository
 */
'use strict';

const { db } = require('../db');

function rowToMessage(row) {
    if (!row) return null;
    return {
        id: row.id,
        recipientId: row.recipient_id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link || null,
        metadata: (() => {
            try { return JSON.parse(row.metadata || '{}'); } catch { return {}; }
        })(),
        read: !!row.read,
        readAt: row.read_at || null,
        createdAt: row.created_at,
    };
}

const messageRepo = {
    rowToMessage,

    async create({ id, recipientId, type, title, body, link, metadata }) {
        await db.runNamed(`
            INSERT INTO messages (id, recipient_id, type, title, body, link, metadata)
            VALUES (@id, @recipient_id, @type, @title, @body, @link, @metadata)
        `, {
            id,
            recipient_id: recipientId,
            type: type || 'system',
            title,
            body,
            link: link || null,
            metadata: JSON.stringify(metadata || {}),
        });
        return this.findById(id);
    },

    async findById(id) {
        return rowToMessage(await db.queryRow('SELECT * FROM messages WHERE id = ?', [id]));
    },

    async listForUser(userId, limit = 40) {
        const safeLimit = Math.max(1, Math.min(200, Number(limit) || 40));
        const { rows } = await db.query(
            `SELECT * FROM messages WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ${safeLimit}`,
            [userId]
        );
        return rows.map(rowToMessage);
    },

    async countUnread(userId) {
        const row = await db.queryRow(
            'SELECT COUNT(*) AS unread_count FROM messages WHERE recipient_id = ? AND read = 0',
            [userId]
        );
        return Number(row?.unread_count || row?.['COUNT(*)'] || 0);
    },

    async markRead(id, userId) {
        await db.run(
            "UPDATE messages SET read = 1, read_at = datetime('now') WHERE id = ? AND recipient_id = ?",
            [id, userId]
        );
        return this.findById(id);
    },

    async markAllRead(userId) {
        await db.run(
            "UPDATE messages SET read = 1, read_at = datetime('now') WHERE recipient_id = ? AND read = 0",
            [userId]
        );
    },
};

module.exports = messageRepo;

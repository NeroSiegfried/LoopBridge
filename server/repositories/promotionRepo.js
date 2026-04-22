/**
 * LoopBridge — Promotion Request Repository
 *
 * Admin users (non-root) can request the root user to promote a regular user to admin.
 */
'use strict';

const { db } = require('../db');

function rowToRequest(row) {
    if (!row) return null;
    return {
        id: row.id,
        requesterId: row.requester_id,
        targetUserId: row.target_user_id,
        requestedRole: row.requested_role,
        status: row.status,
        note: row.note,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at
    };
}

const promotionRepo = {
    async create({ id, requesterId, targetUserId, requestedRole, note }) {
        const now = new Date().toISOString();
        await db.runNamed(`
            INSERT INTO promotion_requests (id, requester_id, target_user_id, requested_role, status, note, created_at)
            VALUES (@id, @requester_id, @target_user_id, @requested_role, 'pending', @note, @now)
        `, {
            id,
            requester_id: requesterId,
            target_user_id: targetUserId,
            requested_role: requestedRole || 'admin',
            note: note || null,
            now
        });
        return this.findById(id);
    },

    async findById(id) {
        return rowToRequest(await db.queryRow('SELECT * FROM promotion_requests WHERE id = ?', [id]));
    },

    async listPending() {
        const { rows } = await db.query(
            "SELECT * FROM promotion_requests WHERE status = 'pending' ORDER BY created_at ASC");
        return rows.map(rowToRequest);
    },

    async listAll() {
        const { rows } = await db.query('SELECT * FROM promotion_requests ORDER BY created_at DESC');
        return rows.map(rowToRequest);
    },

    async listByRequester(requesterId) {
        const { rows } = await db.query(
            'SELECT * FROM promotion_requests WHERE requester_id = ? ORDER BY created_at DESC',
            [requesterId]
        );
        return rows.map(rowToRequest);
    },

    async review(id, status, reviewedById) {
        const now = new Date().toISOString();
        await db.run(
            'UPDATE promotion_requests SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
            [status, reviewedById, now, id]
        );
        return this.findById(id);
    }
};

module.exports = promotionRepo;

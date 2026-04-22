/**
 * LoopBridge — Payment Repository
 */
'use strict';

const { db } = require('../db');

function rowToPayment(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        courseId: row.course_id,
        provider: row.provider,
        reference: row.reference,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        providerData: JSON.parse(row.provider_data || '{}'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

const paymentRepo = {
    async create({ id, userId, courseId, provider, reference, amount, currency }) {
        const now = new Date().toISOString();
        await db.runNamed(`
            INSERT INTO payments (id, user_id, course_id, provider, reference, amount, currency, status, provider_data, created_at, updated_at)
            VALUES (@id, @user_id, @course_id, @provider, @reference, @amount, @currency, 'pending', '{}', @now, @now)
        `, { id, user_id: userId, course_id: courseId, provider, reference, amount, currency: currency || 'NGN', now });
        return this.findByReference(reference);
    },

    async findById(id) {
        return rowToPayment(await db.queryRow('SELECT * FROM payments WHERE id = ?', [id]));
    },

    async findByReference(reference) {
        return rowToPayment(await db.queryRow('SELECT * FROM payments WHERE reference = ?', [reference]));
    },

    async updateStatus(reference, status, providerData = {}) {
        const now = new Date().toISOString();
        await db.run(
            'UPDATE payments SET status = ?, provider_data = ?, updated_at = ? WHERE reference = ?',
            [status, JSON.stringify(providerData), now, reference]
        );
        return this.findByReference(reference);
    },

    async listByUser(userId) {
        const { rows } = await db.query(
            'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return rows.map(rowToPayment);
    },

    async findPendingByUserAndCourse(userId, courseId) {
        return rowToPayment(await db.queryRow(
            "SELECT * FROM payments WHERE user_id = ? AND course_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
            [userId, courseId]
        ));
    }
};

module.exports = paymentRepo;

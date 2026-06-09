/**
 * LoopBridge — Profile Change OTP Repository
 */
'use strict';

const { db } = require('../db');

const profileChangeRepo = {
    async create({ id, userId, field, newValue, target, channel, code, expiresAt }) {
        await db.runNamed(`
            INSERT INTO profile_change_requests (id, user_id, field, new_value, target, channel, code, expires_at)
            VALUES (@id, @user_id, @field, @new_value, @target, @channel, @code, @expires_at)
        `, {
            id,
            user_id: userId,
            field,
            new_value: newValue,
            target,
            channel,
            code,
            expires_at: expiresAt,
        });
    },

    async invalidatePending(userId, field) {
        await db.run(
            "UPDATE profile_change_requests SET used = 1 WHERE user_id = ? AND field = ? AND used = 0 AND expires_at > datetime('now')",
            [userId, field]
        );
    },

    async findValidByIdAndCode({ id, userId, code }) {
        return await db.queryRow(`
            SELECT * FROM profile_change_requests
            WHERE id = ? AND user_id = ? AND code = ? AND used = 0
              AND expires_at > datetime('now')
            ORDER BY created_at DESC LIMIT 1
        `, [id, userId, code]);
    },

    async markUsed(id) {
        await db.run('UPDATE profile_change_requests SET used = 1 WHERE id = ?', [id]);
    },
};

module.exports = profileChangeRepo;

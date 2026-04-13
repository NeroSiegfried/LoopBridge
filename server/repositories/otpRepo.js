/**
 * LoopBridge — OTP Repository
 *
 * Data-access for the otp_codes table.
 */
'use strict';

const { db } = require('../db');

const otpRepo = {
    async create({ phone, code, channel, expiresAt }) {
        await db.run(
            'INSERT INTO otp_codes (phone, code, channel, expires_at) VALUES (?, ?, ?, ?)',
            [phone, code, channel, expiresAt]);
    },

    /**
     * Find the latest unused, non-expired code for a phone + channel.
     */
    async findValid(phone, code, channel) {
        return await db.queryRow(`
            SELECT * FROM otp_codes
            WHERE phone = ? AND code = ? AND channel = ? AND used = 0
              AND expires_at > datetime('now')
            ORDER BY created_at DESC LIMIT 1
        `, [phone, code, channel]);
    },

    async markUsed(id) {
        await db.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [id]);
    },

    async deleteExpired() {
        await db.run("DELETE FROM otp_codes WHERE expires_at <= datetime('now')");
    }
};

module.exports = otpRepo;

/**
 * LoopBridge — User Repository
 *
 * Pure data-access layer for the users table.
 * No HTTP concepts — just takes params and returns plain objects.
 */
'use strict';

const { db } = require('../db');

const userRepo = {
    async findByUsername(username) {
        return await db.queryRow('SELECT * FROM users WHERE username = ?', [username]);
    },

    async findById(id) {
        return await db.queryRow('SELECT * FROM users WHERE id = ?', [id]);
    },

    async findByEmail(email) {
        return await db.queryRow('SELECT * FROM users WHERE email = ?', [email]);
    },

    async findByGoogleId(googleId) {
        return await db.queryRow('SELECT * FROM users WHERE google_id = ?', [googleId]);
    },

    async findByPhone(phone) {
        return await db.queryRow('SELECT * FROM users WHERE phone = ?', [phone]);
    },

    async getAll() {
        const { rows } = await db.query('SELECT id, username, display_name, email, role, avatar, author_of, created_at FROM users ORDER BY created_at DESC');
        return rows;
    },

    async create({ id, username, passwordHash, displayName, email, role, avatar, authorOf, googleId, phone }) {
        await db.runNamed(`
            INSERT INTO users (id, username, password_hash, display_name, email, role, avatar, author_of, google_id, phone)
            VALUES (@id, @username, @password_hash, @display_name, @email, @role, @avatar, @author_of, @google_id, @phone)
        `, {
            id,
            username,
            password_hash: passwordHash,
            display_name: displayName || '',
            email,
            role: role || 'user',
            avatar: avatar || null,
            author_of: JSON.stringify(authorOf || []),
            google_id: googleId || null,
            phone: phone || null
        });
        return this.findById(id);
    },

    async update(id, fields) {
        const existing = await this.findById(id);
        if (!existing) return null;

        const merged = {
            display_name: fields.displayName !== undefined ? fields.displayName : existing.display_name,
            email: fields.email !== undefined ? fields.email : existing.email,
            avatar: fields.avatar !== undefined ? fields.avatar : existing.avatar,
            role: fields.role !== undefined ? fields.role : existing.role,
        };

        await db.runNamed(`
            UPDATE users SET display_name = @display_name, email = @email,
                             avatar = @avatar, role = @role, updated_at = datetime('now')
            WHERE id = @id
        `, { id, ...merged });

        return this.findById(id);
    },

    async linkGoogleId(userId, googleId) {
        await db.run("UPDATE users SET google_id = ?, updated_at = datetime('now') WHERE id = ?",
            [googleId, userId]);
    },

    async setPhoneVerified(userId, phone) {
        await db.run("UPDATE users SET phone = ?, phone_verified = 1, updated_at = datetime('now') WHERE id = ?",
            [phone, userId]);
    }
};

module.exports = userRepo;

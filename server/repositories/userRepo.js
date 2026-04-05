/**
 * LoopBridge — User Repository
 *
 * Pure data-access layer for the users table.
 * No HTTP concepts — just takes params and returns plain objects.
 */
'use strict';

const { getDb } = require('../db');

const userRepo = {
    findByUsername(username) {
        return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
    },

    findById(id) {
        return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    },

    findByEmail(email) {
        return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
    },

    getAll() {
        return getDb().prepare('SELECT id, username, display_name, email, role, avatar, author_of, created_at FROM users ORDER BY created_at DESC').all();
    },

    create({ id, username, passwordHash, displayName, email, role, avatar, authorOf }) {
        getDb().prepare(`
            INSERT INTO users (id, username, password_hash, display_name, email, role, avatar, author_of)
            VALUES (@id, @username, @password_hash, @display_name, @email, @role, @avatar, @author_of)
        `).run({
            id,
            username,
            password_hash: passwordHash,
            display_name: displayName || '',
            email,
            role: role || 'user',
            avatar: avatar || null,
            author_of: JSON.stringify(authorOf || [])
        });
        return this.findById(id);
    },

    update(id, fields) {
        const existing = this.findById(id);
        if (!existing) return null;

        const merged = {
            display_name: fields.displayName !== undefined ? fields.displayName : existing.display_name,
            email: fields.email !== undefined ? fields.email : existing.email,
            avatar: fields.avatar !== undefined ? fields.avatar : existing.avatar,
            role: fields.role !== undefined ? fields.role : existing.role,
        };

        getDb().prepare(`
            UPDATE users SET display_name = @display_name, email = @email,
                             avatar = @avatar, role = @role, updated_at = datetime('now')
            WHERE id = @id
        `).run({ id, ...merged });

        return this.findById(id);
    }
};

module.exports = userRepo;

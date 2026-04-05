/**
 * LoopBridge — Auth Service
 *
 * Business logic for authentication: login, logout, session validation.
 * No HTTP concepts — receives plain args, returns plain objects or throws.
 */
'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { userRepo, sessionRepo } = require('../repositories');

function sanitiseUser(row) {
    return {
        id: row.uid || row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        role: row.role,
        avatar: row.avatar,
        authorOf: JSON.parse(row.author_of || '[]')
    };
}

const authService = {
    /**
     * Validate credentials and create a session.
     * @returns {{ user, sessionId, expiresAt }} or throws
     */
    async login(username, password) {
        if (!username || !password) {
            const err = new Error('Username and password are required.');
            err.status = 400;
            throw err;
        }

        const user = userRepo.findByUsername(username);
        if (!user) {
            const err = new Error('Invalid credentials.');
            err.status = 401;
            throw err;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            const err = new Error('Invalid credentials.');
            err.status = 401;
            throw err;
        }

        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
        sessionRepo.create({ id: sessionId, userId: user.id, expiresAt });

        return {
            user: sanitiseUser(user),
            sessionId,
            expiresAt
        };
    },

    /**
     * Destroy a session.
     */
    logout(sessionId) {
        if (sessionId) {
            sessionRepo.deleteById(sessionId);
        }
    },

    /**
     * Look up the current session + user.
     * @returns {Object|null} user object or null
     */
    getSession(sessionId) {
        if (!sessionId) return null;
        const row = sessionRepo.findValidWithUser(sessionId);
        if (!row) return null;
        return sanitiseUser(row);
    }
};

module.exports = authService;

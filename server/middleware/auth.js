/**
 * LoopBridge — Auth Middleware
 *
 * Attaches req.user from session cookie.
 * Exports guard functions for route protection.
 */
'use strict';

const config = require('../config');
const { sessionRepo } = require('../repositories');

/**
 * Attach user to req from session cookie (runs on every request).
 */
async function sessionMiddleware(req, res, next) {
    req.user = null;
    const sessionId = req.cookies[config.cookieName];
    if (!sessionId) return next();

    const session = await sessionRepo.findValidWithUser(sessionId);

    if (session) {
        req.user = {
            id: session.uid,
            username: session.username,
            displayName: session.display_name,
            email: session.email,
            role: session.role,
            avatar: session.avatar,
            authorOf: JSON.parse(session.author_of || '[]')
        };
    }
    next();
}

/**
 * Require any authenticated user.
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    next();
}

/**
 * Require author or admin role.
 */
function requireAuthor(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'author') {
        return res.status(403).json({ error: 'Author or admin role required.' });
    }
    next();
}

/**
 * Require admin role.
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required.' });
    }
    next();
}

/**
 * Check if current user is the owner of an item (by author_name) or admin.
 * Used inline in route handlers — returns false and sends 403 if denied.
 */
function requireOwnerOrAdmin(req, res, item) {
    if (req.user.role === 'admin') return true;
    if (req.user.role === 'author' && req.user.authorOf.includes(item.id)) return true;

    res.status(403).json({ error: 'You do not have permission to modify this item.' });
    return false;
}

module.exports = {
    sessionMiddleware,
    requireAuth,
    requireAuthor,
    requireAdmin,
    requireOwnerOrAdmin
};

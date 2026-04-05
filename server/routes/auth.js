/**
 * LoopBridge — Auth Routes (thin controller)
 *
 * POST /api/auth/login     — login with username + password
 * POST /api/auth/logout    — destroy session
 * GET  /api/auth/session   — get current session / user info
 */
'use strict';

const express = require('express');
const config = require('../config');
const { authService } = require('../services');

const router = express.Router();

// ─── POST /api/auth/login ───────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { user, sessionId } = await authService.login(username, password);

        res.cookie(config.cookieName, sessionId, {
            httpOnly: true,
            secure: config.cookieSecure,
            sameSite: config.cookieSameSite,
            maxAge: config.sessionTtlMs,
            path: '/'
        });

        return res.json(user);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message });
    }
});

// ─── POST /api/auth/logout ──────────────────────────────
router.post('/logout', (req, res) => {
    authService.logout(req.cookies[config.cookieName]);
    res.clearCookie(config.cookieName, { path: '/' });
    return res.json({ ok: true });
});

// ─── GET /api/auth/session ──────────────────────────────
router.get('/session', (req, res) => {
    const user = authService.getSession(req.cookies[config.cookieName]);
    if (!user) {
        res.clearCookie(config.cookieName, { path: '/' });
        return res.json({ user: null });
    }
    return res.json({ user });
});

module.exports = router;

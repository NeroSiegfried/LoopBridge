/**
 * LoopBridge — Auth Routes (thin controller)
 *
 * POST /api/auth/login         — login with username + password
 * POST /api/auth/google        — Google Sign-In (ID token)
 * POST /api/auth/otp/send      — send OTP to phone (via email / WhatsApp)
 * POST /api/auth/otp/verify    — verify OTP and login / register
 * POST /api/auth/logout        — destroy session
 * GET  /api/auth/session       — get current session / user info
 * GET  /api/auth/google-client-id — return GOOGLE_CLIENT_ID for frontend
 */
'use strict';

const express = require('express');
const config = require('../config');
const { authService } = require('../services');

const router = express.Router();

// Helper: set session cookie
function setSessionCookie(res, sessionId) {
    res.cookie(config.cookieName, sessionId, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSameSite,
        maxAge: config.sessionTtlMs,
        path: '/'
    });
}

// ─── POST /api/auth/login ───────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const { user, sessionId } = await authService.login(username, password);
        setSessionCookie(res, sessionId);
        return res.json(user);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message });
    }
});

// ─── POST /api/auth/google ──────────────────────────────
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Missing Google credential token.' });

        const { user, sessionId } = await authService.googleLogin(credential);
        setSessionCookie(res, sessionId);
        return res.json(user);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message });
    }
});

// ─── GET /api/auth/google-client-id ─────────────────────
router.get('/google-client-id', (req, res) => {
    return res.json({ clientId: config.googleClientId || null });
});

// ─── POST /api/auth/otp/send ────────────────────────────
router.post('/otp/send', async (req, res) => {
    try {
        const { phone, channel } = req.body; // channel: 'email' | 'whatsapp'
        const result = await authService.sendOtp(phone, channel || 'email');
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message });
    }
});

// ─── POST /api/auth/otp/verify ──────────────────────────
router.post('/otp/verify', async (req, res) => {
    try {
        const { phone, code, channel, displayName, email } = req.body;
        const { user, sessionId } = await authService.verifyOtpAndLogin({
            phone, code, channel, displayName, email
        });
        setSessionCookie(res, sessionId);
        return res.json(user);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message });
    }
});

// ─── POST /api/auth/logout ──────────────────────────────
router.post('/logout', async (req, res) => {
    await authService.logout(req.cookies[config.cookieName]);
    res.clearCookie(config.cookieName, { path: '/' });
    return res.json({ ok: true });
});

// ─── GET /api/auth/session ──────────────────────────────
router.get('/session', async (req, res) => {
    const user = await authService.getSession(req.cookies[config.cookieName]);
    if (!user) {
        res.clearCookie(config.cookieName, { path: '/' });
        return res.json({ user: null });
    }
    return res.json({ user });
});

module.exports = router;

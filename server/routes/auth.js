/**
 * LoopBridge — Auth Routes (thin controller)
 *
 * POST /api/auth/login         — login with username + password
 * POST /api/auth/google        — Google Sign-In (ID token)
 * POST /api/auth/otp/send      — send OTP to phone/email (via email / WhatsApp / SMS)
 * POST /api/auth/otp/verify    — verify OTP and login / register
 * POST /api/auth/logout        — destroy session
 * GET  /api/auth/session       — get current session / user info
 * GET  /api/auth/google-client-id — return GOOGLE_CLIENT_ID for frontend
 */
'use strict';

const express    = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config     = require('../config');
const { authService } = require('../services');

const router = express.Router();

// ─── Rate limiters ──────────────────────────────────────
// OTP send: max 5 requests per phone per 10 minutes (keyed by IP + body.phone)
const otpSendLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 min
    max: 5,
    keyGenerator: (req) => `${ipKeyGenerator(req)}:${(req.body?.phone || '').replace(/\s/g, '')}`,
    handler: (req, res) => res.status(429).json({
        error: 'Too many OTP requests. Please wait 10 minutes before trying again.'
    }),
    standardHeaders: true,
    legacyHeaders:   false,
});

// OTP verify: max 10 attempts per phone per 10 minutes
const otpVerifyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `${ipKeyGenerator(req)}:${(req.body?.phone || '').replace(/\s/g, '')}`,
    handler: (req, res) => res.status(429).json({
        error: 'Too many verification attempts. Please wait 10 minutes.'
    }),
    standardHeaders: true,
    legacyHeaders:   false,
});

// Login: max 10 attempts per IP per 5 minutes
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    handler: (req, res) => res.status(429).json({
        error: 'Too many login attempts. Please wait 5 minutes.'
    }),
    standardHeaders: true,
    legacyHeaders:   false,
});

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
router.post('/login', loginLimiter, async (req, res) => {
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
// Body: { phone, email?, channel? }
// phone can be a phone number (for WhatsApp/SMS) or email address (for email OTP)
// channel: 'email' | 'whatsapp' | 'sms' | 'both'
router.post('/otp/send', otpSendLimiter, async (req, res) => {
    try {
        const { phone, email, channel } = req.body;

        // If caller supplies a dedicated email field, send to that;
        // otherwise use the phone field (which may be an email or a phone number)
        const target = email || phone;
        const result = await authService.sendOtp(target, channel || 'email');
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ error: err.message });
    }
});

// ─── POST /api/auth/otp/verify ──────────────────────────
router.post('/otp/verify', otpVerifyLimiter, async (req, res) => {
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

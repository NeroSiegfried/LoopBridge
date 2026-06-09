/**
 * LoopBridge — Profile Routes (OTP-protected updates)
 */
'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { profileChangeRepo, userRepo } = require('../repositories');

const router = express.Router();

function sanitiseUser(row) {
    return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        role: row.role,
        isRoot: !!row.is_root,
        avatar: row.avatar,
        authorOf: JSON.parse(row.author_of || '[]'),
        phone: row.phone || null,
        phoneVerified: !!row.phone_verified,
    };
}

function isValidEmail(email) {
    return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(phone) {
    if (!phone) return null;
    const trimmed = String(phone).trim();
    return trimmed || null;
}

function isValidUsername(username) {
    return !!username && /^[a-zA-Z0-9_]{3,32}$/.test(username);
}

router.get('/', requireAuth, async (req, res) => {
    const user = await userRepo.findById(req.user.id);
    return res.json({ user: sanitiseUser(user) });
});

router.post('/request-change-otp', requireAuth, async (req, res) => {
    const { field, value, channel } = req.body || {};
    const user = await userRepo.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const normalizedField = String(field || '').trim();
    if (!['email', 'phone', 'username'].includes(normalizedField)) {
        return res.status(400).json({ error: 'field must be one of: email, phone, username.' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const requestId = uuidv4();

    let target = null;
    let newValue = null;
    let deliveryChannel = channel || 'email';

    if (normalizedField === 'email') {
        newValue = String(value || '').trim().toLowerCase();
        if (!isValidEmail(newValue)) return res.status(400).json({ error: 'Valid email is required.' });
        const existing = await userRepo.findByEmail(newValue);
        if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Email already in use.' });
        target = newValue;
        deliveryChannel = 'email';
    }

    if (normalizedField === 'phone') {
        newValue = normalizePhone(value);
        if (!newValue || newValue.length < 7) return res.status(400).json({ error: 'Valid phone is required.' });
        const existing = await userRepo.findByPhone(newValue);
        if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Phone already in use.' });
        target = newValue;
        deliveryChannel = (deliveryChannel === 'sms' || deliveryChannel === 'whatsapp') ? deliveryChannel : 'sms';
    }

    if (normalizedField === 'username') {
        newValue = String(value || '').trim();
        if (!isValidUsername(newValue)) {
            return res.status(400).json({ error: 'Username must be 3-32 chars, letters/numbers/underscore only.' });
        }
        const existing = await userRepo.findByUsername(newValue);
        if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Username already in use.' });
        target = user.email || user.phone;
        if (!target) return res.status(400).json({ error: 'No email or phone available for OTP delivery.' });
        if (target.includes('@')) deliveryChannel = 'email';
        else deliveryChannel = (deliveryChannel === 'whatsapp') ? 'whatsapp' : 'sms';
    }

    await profileChangeRepo.invalidatePending(user.id, normalizedField);
    await profileChangeRepo.create({
        id: requestId,
        userId: user.id,
        field: normalizedField,
        newValue,
        target,
        channel: deliveryChannel,
        code,
        expiresAt,
    });

    try {
        if (deliveryChannel === 'email') {
            await notificationService.sendOtpEmail(target, code);
        } else if (deliveryChannel === 'whatsapp') {
            await notificationService.sendOtpWhatsApp(target, code);
        } else {
            await notificationService.sendOtpSms(target, code);
        }
    } catch (err) {
        return res.status(500).json({ error: `Failed to send OTP: ${err.message}` });
    }

    return res.json({
        ok: true,
        requestId,
        field: normalizedField,
        channel: deliveryChannel,
        expiresInSeconds: 600,
        ...(process.env.NODE_ENV !== 'production' ? { code } : {}),
    });
});

router.post('/verify-change-otp', requireAuth, async (req, res) => {
    const { requestId, code } = req.body || {};
    if (!requestId || !code) return res.status(400).json({ error: 'requestId and code are required.' });

    const pending = await profileChangeRepo.findValidByIdAndCode({
        id: requestId,
        userId: req.user.id,
        code: String(code).trim(),
    });
    if (!pending) return res.status(401).json({ error: 'Invalid or expired OTP.' });

    let user;
    if (pending.field === 'email') user = await userRepo.setEmail(req.user.id, pending.new_value);
    if (pending.field === 'phone') user = await userRepo.setPhone(req.user.id, pending.new_value);
    if (pending.field === 'username') user = await userRepo.setUsername(req.user.id, pending.new_value);

    await profileChangeRepo.markUsed(pending.id);
    return res.json({ ok: true, user: sanitiseUser(user) });
});

module.exports = router;

/**
 * LoopBridge — FAQs & Misc Read-Only Routes (thin controller)
 *
 * GET  /api/faqs              — all FAQs grouped by category
 * GET  /api/faqs/categories   — list of FAQ category names
 * GET  /api/site              — site config (from site.json)
 * GET  /api/site/config       — public site config from env vars (socials, contacts)
 * GET  /api/team              — team members
 * GET  /api/platforms         — community platforms
 * GET  /api/health            — health check (for ALB / container probes)
 * POST /api/newsletter/subscribe   — subscribe email to newsletter
 * POST /api/newsletter/unsubscribe — unsubscribe email
 */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { faqRepo, subscriberRepo } = require('../repositories');

const router = express.Router();

function readStaticJSON(filename) {
    const filePath = path.join(config.dataDir, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── GET /api/faqs ──────────────────────────────────────
router.get('/faqs', async (req, res) => {
    return res.json(await faqRepo.listGrouped());
});

// ─── GET /api/faqs/categories ───────────────────────────
router.get('/faqs/categories', async (req, res) => {
    return res.json(await faqRepo.listCategories());
});

// ─── GET /api/site ──────────────────────────────────────
router.get('/site', (req, res) => {
    const data = readStaticJSON('site.json');
    if (!data) return res.status(404).json({ error: 'site.json not found.' });
    return res.json(data);
});

// ─── GET /api/team ──────────────────────────────────────
router.get('/team', (req, res) => {
    const data = readStaticJSON('team.json');
    if (!data) return res.status(404).json({ error: 'team.json not found.' });
    return res.json(data.members || []);
});

// ─── GET /api/platforms ─────────────────────────────────
router.get('/platforms', (req, res) => {
    const data = readStaticJSON('platforms.json');
    if (!data) return res.status(404).json({ error: 'platforms.json not found.' });
    return res.json(data.platforms || []);
});

// ─── GET /api/health ────────────────────────────────────
router.get('/health', (req, res) => {
    return res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ─── GET /api/site/config ───────────────────────────────
// Public config built from env vars — no file dependency
router.get('/site/config', (req, res) => {
    return res.json({
        socials: {
            telegram: config.socialTelegram,
            discord: config.socialDiscord,
            youtube: config.socialYoutube,
            twitter: config.socialTwitter,
            tiktok: config.socialTiktok,
            whatsapp: config.socialWhatsapp,
        },
        contacts: {
            general: config.contactGeneral,
            press: config.contactPress,
            support: config.contactSupport,
        },
        whatsappCommunityLink: config.whatsappCommunityLink,
    });
});

// ─── POST /api/newsletter/subscribe ─────────────────────
router.post('/newsletter/subscribe', async (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required.' });
    }

    // Basic email validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    try {
        const result = await subscriberRepo.subscribe(email.trim(), 'newsletter');
        return res.json({
            message: result.isNew
                ? 'Welcome! You\'ve been subscribed to the LoopBridge newsletter.'
                : 'You\'re already subscribed. Stay tuned!',
            subscribed: true,
        });
    } catch (err) {
        console.error('Newsletter subscribe error:', err);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ─── POST /api/newsletter/unsubscribe ───────────────────
router.post('/newsletter/unsubscribe', async (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        await subscriberRepo.unsubscribe(email.trim());
        return res.json({ message: 'You\'ve been unsubscribed.', subscribed: false });
    } catch (err) {
        console.error('Newsletter unsubscribe error:', err);
        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

module.exports = router;

/**
 * LoopBridge — FAQs & Misc Read-Only Routes (thin controller)
 *
 * GET /api/faqs              — all FAQs grouped by category
 * GET /api/faqs/categories   — list of FAQ category names
 * GET /api/site              — site config
 * GET /api/team              — team members
 * GET /api/platforms         — community platforms
 * GET /api/health            — health check (for ALB / container probes)
 */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { faqRepo } = require('../repositories');

const router = express.Router();

function readStaticJSON(filename) {
    const filePath = path.join(config.dataDir, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── GET /api/faqs ──────────────────────────────────────
router.get('/faqs', (req, res) => {
    return res.json(faqRepo.listGrouped());
});

// ─── GET /api/faqs/categories ───────────────────────────
router.get('/faqs/categories', (req, res) => {
    return res.json(faqRepo.listCategories());
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

module.exports = router;

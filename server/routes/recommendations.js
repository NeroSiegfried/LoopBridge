/**
 * LoopBridge — Recommendations Routes
 *
 * GET  /api/recommendations/articles   — recommended articles for the current user
 * GET  /api/recommendations/courses    — recommended courses for the current user
 * GET  /api/recommendations/profile    — user's interest profile
 * POST /api/recommendations/analyse    — analyse article text for category suggestions
 */
'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const recommendationService = require('../services/recommendationService');

const router = express.Router();

// ─── GET /api/recommendations/articles ──────────────────
router.get('/articles', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const articles = await recommendationService.recommendArticles(req.user.id, limit);
        return res.json(articles);
    } catch (err) {
        console.error('[recommendations] Article recommendation error:', err.message);
        return res.status(500).json({ error: 'Failed to generate recommendations.' });
    }
});

// ─── GET /api/recommendations/courses ───────────────────
router.get('/courses', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const courses = await recommendationService.recommendCourses(req.user.id, limit);
        return res.json(courses);
    } catch (err) {
        console.error('[recommendations] Course recommendation error:', err.message);
        return res.status(500).json({ error: 'Failed to generate recommendations.' });
    }
});

// ─── GET /api/recommendations/profile ───────────────────
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const profile = await recommendationService.getUserProfile(req.user.id);
        return res.json(profile);
    } catch (err) {
        console.error('[recommendations] Profile error:', err.message);
        return res.status(500).json({ error: 'Failed to get user profile.' });
    }
});

// ─── POST /api/recommendations/analyse ──────────────────
// Body: { title, description, content }
// Returns: { primary, scores: [{ category, score }] }
router.post('/analyse', async (req, res) => {
    try {
        const { title, description, content } = req.body;
        const result = await recommendationService.analyseArticle({ title, description, content });
        return res.json(result);
    } catch (err) {
        console.error('[recommendations] Analyse error:', err.message);
        return res.status(500).json({ error: 'Failed to analyse content.' });
    }
});

module.exports = router;

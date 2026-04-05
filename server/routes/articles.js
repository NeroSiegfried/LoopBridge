/**
 * LoopBridge — Articles Routes (thin controller)
 *
 * GET    /api/articles            — list articles
 * GET    /api/articles/:id        — single article
 * POST   /api/articles            — create article   (auth: author+)
 * PUT    /api/articles/:id        — update article    (auth: owner / admin)
 * DELETE /api/articles/:id        — soft-delete        (auth: owner / admin)
 * POST   /api/articles/:id/restore — restore           (auth: admin)
 */
'use strict';

const express = require('express');
const { requireAuth, requireAuthor } = require('../middleware/auth');
const { articleService } = require('../services');

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────
function sendResult(res, result, successStatus = 200) {
    if (result && result.error) {
        return res.status(result.status || 500).json({ error: result.error });
    }
    return res.status(successStatus).json(result);
}

// ─── GET /api/articles ──────────────────────────────────
router.get('/', (req, res) => {
    const { category, featured, includeDeleted } = req.query;
    // Only admins can see deleted items via the public listing
    const canSeeDeleted = includeDeleted && req.user && req.user.role === 'admin';
    const articles = articleService.list({ category, featured, includeDeleted: canSeeDeleted });
    return res.json(articles);
});

// ─── GET /api/articles/:id ──────────────────────────────
router.get('/:id', (req, res) => {
    const article = articleService.getById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found.' });
    return res.json(article);
});

// ─── POST /api/articles ─────────────────────────────────
router.post('/', requireAuthor, (req, res) => {
    const article = articleService.create(req.body, req.user);
    return res.status(201).json(article);
});

// ─── PUT /api/articles/:id ──────────────────────────────
router.put('/:id', requireAuth, (req, res) => {
    const result = articleService.update(req.params.id, req.body, req.user);
    sendResult(res, result);
});

// ─── DELETE /api/articles/:id ───────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
    const result = articleService.delete(req.params.id, req.user);
    sendResult(res, result);
});

// ─── POST /api/articles/:id/restore ─────────────────────
router.post('/:id/restore', requireAuth, (req, res) => {
    const result = articleService.restore(req.params.id, req.user);
    sendResult(res, result);
});

module.exports = router;

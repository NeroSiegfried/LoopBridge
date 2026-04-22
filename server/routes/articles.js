/**
 * LoopBridge — Articles Routes
 *
 * GET    /api/articles                   — list (public: approved + not hidden + not deleted)
 * GET    /api/articles/:id               — single article
 * POST   /api/articles                   — create        (author+)
 * PUT    /api/articles/:id               — edit          (author-owner or admin)
 * DELETE /api/articles/:id               — soft-delete   (author-owner or admin)
 * POST   /api/articles/:id/restore       — restore       (admin)
 * POST   /api/articles/:id/approve       — approve       (admin)
 * POST   /api/articles/:id/unapprove     — unapprove/take-down  (admin)
 * POST   /api/articles/:id/hide          — hide          (author-owner or admin)
 * POST   /api/articles/:id/unhide        — unhide        (author-owner or admin)
 * DELETE /api/articles/:id/hard          — hard-delete   (root only)
 */
'use strict';

const express = require('express');
const { requireAuth, requireAuthor, requireAdmin, requireRoot } = require('../middleware/auth');
const { articleService } = require('../services');
const { categorise, getCategories } = require('../services/categorizationService');

const router = express.Router();

function sendResult(res, result, successStatus = 200) {
    if (result && result.error) return res.status(result.status || 500).json({ error: result.error });
    return res.status(successStatus).json(result);
}

// ─── Public reads ────────────────────────────────────────
router.get('/', async (req, res) => {
    const { category, featured, includeDeleted } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const articles = await articleService.list({
        category, featured,
        includeDeleted:    isAdmin && includeDeleted,
        includeHidden:     isAdmin,
        includeUnapproved: isAdmin
    });
    return res.json(articles);
});

router.get('/categories', (req, res) => res.json(getCategories()));

router.get('/:id', async (req, res) => {
    const article = await articleService.getById(req.params.id);
    if (!article) return res.status(404).json({ error: 'Article not found.' });
    // Non-admins cannot see deleted/hidden/unapproved articles
    if (!req.user || req.user.role !== 'admin') {
        if (article.deleted || article.hidden || !article.approved) {
            return res.status(404).json({ error: 'Article not found.' });
        }
    }
    return res.json(article);
});

// ─── Mutating ────────────────────────────────────────────
router.post('/', requireAuthor, async (req, res) => {
    const article = await articleService.create(req.body, req.user);
    return res.status(201).json(article);
});

router.post('/categorise', (req, res) => {
    const result = categorise(req.body);
    return res.json(result);
});

router.put('/:id', requireAuth, async (req, res) => {
    sendResult(res, await articleService.update(req.params.id, req.body, req.user));
});

router.delete('/:id', requireAuth, async (req, res) => {
    sendResult(res, await articleService.delete(req.params.id, req.user));
});

// ─── Admin moderation ────────────────────────────────────
router.post('/:id/restore',  requireAdmin, async (req, res) => {
    sendResult(res, await articleService.restore(req.params.id, req.user));
});
router.post('/:id/approve',  requireAdmin, async (req, res) => {
    sendResult(res, await articleService.approve(req.params.id, req.user));
});
router.post('/:id/unapprove', requireAdmin, async (req, res) => {
    sendResult(res, await articleService.unapprove(req.params.id, req.user));
});

// ─── Hide/Unhide (author-owner or admin) ─────────────────
router.post('/:id/hide',   requireAuth, async (req, res) => {
    sendResult(res, await articleService.hide(req.params.id, req.user));
});
router.post('/:id/unhide', requireAuth, async (req, res) => {
    sendResult(res, await articleService.unhide(req.params.id, req.user));
});

// ─── Hard delete (root only) ─────────────────────────────
router.delete('/:id/hard', requireRoot, async (req, res) => {
    sendResult(res, await articleService.hardDelete(req.params.id, req.user));
});

module.exports = router;

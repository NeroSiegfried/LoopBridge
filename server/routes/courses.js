/**
 * LoopBridge — Courses Routes
 *
 * GET    /api/courses                    — list (public: approved + not hidden + not deleted)
 * GET    /api/courses/:id                — single course
 * POST   /api/courses                    — create         (author+)
 * PUT    /api/courses/:id                — edit           (author-owner or admin)
 * DELETE /api/courses/:id                — soft-delete    (author-owner or admin)
 * POST   /api/courses/:id/restore        — restore        (admin)
 * POST   /api/courses/:id/approve        — approve        (admin)
 * POST   /api/courses/:id/unapprove      — take down      (admin)
 * POST   /api/courses/:id/hide           — hide           (author-owner or admin)
 * POST   /api/courses/:id/unhide         — unhide         (author-owner or admin)
 *
 * Progress / Enrollment:
 * GET    /api/courses/:id/progress       — get user progress
 * POST   /api/courses/:id/enroll         — enroll (free) or confirm paid enrollment
 * GET    /api/courses/:id/content        — access-gated content check
 * POST   /api/courses/:id/progress       — toggle subsection completion
 */
'use strict';

const express = require('express');
const { requireAuth, requireAuthor, requireAdmin } = require('../middleware/auth');
const { courseService } = require('../services');

const router = express.Router();

function sendResult(res, result, successStatus = 200) {
    if (result && result.error) return res.status(result.status || 500).json({ error: result.error });
    return res.status(successStatus).json(result);
}

// ─── List ────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const { track, includeDeleted } = req.query;
    const isAdmin = req.user?.role === 'admin';
    return res.json(await courseService.list({
        track,
        includeDeleted:    isAdmin && !!includeDeleted,
        includeHidden:     isAdmin,
        includeUnapproved: isAdmin
    }));
});

// ─── Single course ───────────────────────────────────────
router.get('/:id', async (req, res) => {
    const course = await courseService.getById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    if (!req.user || req.user.role !== 'admin') {
        if (course.deleted || course.hidden || !course.approved) {
            return res.status(404).json({ error: 'Course not found.' });
        }
    }
    return res.json(course);
});

// ─── CRUD ────────────────────────────────────────────────
router.post('/', requireAuthor, async (req, res) => {
    const course = await courseService.create(req.body, req.user);
    return res.status(201).json(course);
});

router.put('/:id', requireAuth, async (req, res) => {
    sendResult(res, await courseService.update(req.params.id, req.body, req.user));
});

router.delete('/:id', requireAuth, async (req, res) => {
    sendResult(res, await courseService.delete(req.params.id, req.user));
});

// ─── Admin moderation ────────────────────────────────────
router.post('/:id/restore',  requireAdmin, async (req, res) => {
    sendResult(res, await courseService.restore(req.params.id, req.user));
});
router.post('/:id/approve',  requireAdmin, async (req, res) => {
    sendResult(res, await courseService.approve(req.params.id, req.user));
});
router.post('/:id/unapprove', requireAdmin, async (req, res) => {
    sendResult(res, await courseService.unapprove(req.params.id, req.user));
});

// ─── Hide/Unhide (author-owner or admin) ─────────────────
router.post('/:id/hide',   requireAuth, async (req, res) => {
    sendResult(res, await courseService.hide(req.params.id, req.user));
});
router.post('/:id/unhide', requireAuth, async (req, res) => {
    sendResult(res, await courseService.unhide(req.params.id, req.user));
});

// ─── Enrollment ──────────────────────────────────────────
router.post('/:id/enroll', requireAuth, async (req, res) => {
    // paymentId is passed by client after a successful payment verification
    const { paymentId } = req.body;
    sendResult(res, await courseService.enroll(req.user.id, req.params.id, paymentId || null));
});

// ─── Content access check ────────────────────────────────
// Returns { canAccess: bool } — client calls this before showing lesson content
router.get('/:id/access', requireAuth, async (req, res) => {
    const canAccess = await courseService.canAccessContent(
        req.user.id, req.user.role, req.user.isRoot, req.params.id
    );
    return res.json({ canAccess });
});

// ─── Progress ────────────────────────────────────────────
router.get('/:id/progress', requireAuth, async (req, res) => {
    return res.json(await courseService.getProgress(req.user.id, req.params.id));
});

router.post('/:id/progress', requireAuth, async (req, res) => {
    const { subsectionId, complete } = req.body;
    sendResult(res, await courseService.updateProgress(req.user.id, req.params.id, subsectionId, complete));
});

module.exports = router;

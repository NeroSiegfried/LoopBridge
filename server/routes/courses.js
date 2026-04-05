/**
 * LoopBridge — Courses Routes (thin controller)
 *
 * GET    /api/courses            — list courses
 * GET    /api/courses/:id        — single course
 * POST   /api/courses            — create course   (auth: author+)
 * PUT    /api/courses/:id        — update course    (auth: owner / admin)
 * DELETE /api/courses/:id        — soft-delete
 * POST   /api/courses/:id/restore — restore
 *
 * Progress:
 * GET    /api/courses/:id/progress  — get user progress
 * POST   /api/courses/:id/enroll    — enroll
 * POST   /api/courses/:id/progress  — toggle subsection
 */
'use strict';

const express = require('express');
const { requireAuth, requireAuthor } = require('../middleware/auth');
const { courseService } = require('../services');

const router = express.Router();

function sendResult(res, result, successStatus = 200) {
    if (result && result.error) {
        return res.status(result.status || 500).json({ error: result.error });
    }
    return res.status(successStatus).json(result);
}

// ─── CRUD ───────────────────────────────────────────────

router.get('/', (req, res) => {
    const { track, includeDeleted } = req.query;
    const canSeeDeleted = includeDeleted && req.user && req.user.role === 'admin';
    return res.json(courseService.list({ track, includeDeleted: canSeeDeleted }));
});

router.get('/:id', (req, res) => {
    const course = courseService.getById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    return res.json(course);
});

router.post('/', requireAuthor, (req, res) => {
    const course = courseService.create(req.body, req.user);
    return res.status(201).json(course);
});

router.put('/:id', requireAuth, (req, res) => {
    sendResult(res, courseService.update(req.params.id, req.body, req.user));
});

router.delete('/:id', requireAuth, (req, res) => {
    sendResult(res, courseService.delete(req.params.id, req.user));
});

router.post('/:id/restore', requireAuth, (req, res) => {
    sendResult(res, courseService.restore(req.params.id, req.user));
});

// ─── Progress ───────────────────────────────────────────

router.get('/:id/progress', requireAuth, (req, res) => {
    const progress = courseService.getProgress(req.user.id, req.params.id);
    return res.json(progress);
});

router.post('/:id/enroll', requireAuth, (req, res) => {
    const result = courseService.enroll(req.user.id, req.params.id);
    sendResult(res, result);
});

router.post('/:id/progress', requireAuth, (req, res) => {
    const { subsectionId, complete } = req.body;
    const result = courseService.updateProgress(req.user.id, req.params.id, subsectionId, complete);
    sendResult(res, result);
});

module.exports = router;

/**
 * LoopBridge — Dashboard Routes
 *
 * GET /api/dashboard  — returns articles + courses filtered by the user's role
 *   admin  → all (including deleted)
 *   author → only items they own
 *   user   → 403 (no dashboard access)
 */
'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { articleService, courseService } = require('../services');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
    const user = req.user;

    if (user.role !== 'admin' && user.role !== 'author') {
        return res.status(403).json({ error: 'Dashboard access requires author or admin role.' });
    }

    const articles = articleService.listForDashboard(user);
    const courses = courseService.listForDashboard(user);

    return res.json({ articles, courses });
});

module.exports = router;

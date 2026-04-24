/**
 * LoopBridge — Admin User Management Routes
 *
 * All routes require admin or root unless noted.
 *
 * GET    /api/admin/users                    — list all users        (admin+)
 * GET    /api/admin/users/:id                — single user           (admin+)
 * PATCH  /api/admin/users/:id/role           — change role           (root only)
 *
 * Promotion requests (admin → asks root to promote a user):
 * GET    /api/admin/promotion-requests       — list pending requests (root sees all; admin sees own)
 * POST   /api/admin/promotion-requests       — create request        (admin, non-root)
 * POST   /api/admin/promotion-requests/:id/approve — approve        (root only)
 * POST   /api/admin/promotion-requests/:id/reject  — reject         (root only)
 */
'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAdmin, requireRoot } = require('../middleware/auth');
const { userRepo, promotionRepo } = require('../repositories');
const { messageService } = require('../services');

const router = express.Router();

function safeUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        role: row.role,
        isRoot: !!row.is_root,
        avatar: row.avatar,
        createdAt: row.created_at
    };
}

// ─── User list / detail ──────────────────────────────────
router.get('/users', requireAdmin, async (req, res) => {
    const rows = await userRepo.getAll();
    return res.json(rows.map(safeUser));
});

router.get('/users/:id', requireAdmin, async (req, res) => {
    const row = await userRepo.findById(req.params.id);
    if (!row) return res.status(404).json({ error: 'User not found.' });
    return res.json(safeUser(row));
});

// ─── Role change (root only) ─────────────────────────────
router.patch('/users/:id/role', requireRoot, async (req, res) => {
    const { role } = req.body;
    const allowed = ['user', 'author', 'admin'];
    if (!allowed.includes(role)) {
        return res.status(400).json({ error: `role must be one of: ${allowed.join(', ')}` });
    }

    const target = await userRepo.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.is_root) return res.status(403).json({ error: 'Cannot change the root user\'s role.' });

    const updated = await userRepo.setRole(req.params.id, role);
    return res.json(safeUser(updated));
});

// ─── Promotion requests ──────────────────────────────────

// Admin creates a request asking root to promote someone
router.post('/promotion-requests', requireAdmin, async (req, res) => {
    if (req.user.isRoot) {
        return res.status(400).json({ error: 'Root can change roles directly via PATCH /users/:id/role.' });
    }
    const { targetUserId, requestedRole, note } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required.' });

    const target = await userRepo.findById(targetUserId);
    if (!target) return res.status(404).json({ error: 'Target user not found.' });
    if (target.is_root) return res.status(403).json({ error: 'Cannot request role change for root.' });

    const request = await promotionRepo.create({
        id: uuidv4(),
        requesterId: req.user.id,
        targetUserId,
        requestedRole: requestedRole || 'admin',
        note
    });

    await messageService.notifyRoots({
        type: 'promotion_request',
        title: 'Promotion request submitted',
        body: `${req.user.displayName || req.user.username} requested ${target.username} be promoted to ${request.requestedRole}.`,
        link: '/admin/dashboard',
        metadata: { requestId: request.id, targetUserId: target.id, requesterId: req.user.id },
    });

    return res.status(201).json(request);
});

// Root sees all; admin sees own requests
router.get('/promotion-requests', requireAdmin, async (req, res) => {
    const list = req.user.isRoot
        ? await promotionRepo.listAll()
        : await promotionRepo.listByRequester(req.user.id);
    return res.json(list);
});

// Root approves → actually changes role
router.post('/promotion-requests/:id/approve', requireRoot, async (req, res) => {
    const promo = await promotionRepo.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Request not found.' });
    if (promo.status !== 'pending') return res.status(400).json({ error: 'Request already reviewed.' });

    await userRepo.setRole(promo.targetUserId, promo.requestedRole);
    const updated = await promotionRepo.review(promo.id, 'approved', req.user.id);

    await messageService.notifyUser(promo.requesterId, {
        type: 'promotion_request_approved',
        title: 'Promotion request approved',
        body: `Your promotion request for user ${promo.targetUserId} was approved.`,
        link: '/admin/dashboard',
        metadata: { requestId: promo.id },
    });

    return res.json(updated);
});

// Root rejects
router.post('/promotion-requests/:id/reject', requireRoot, async (req, res) => {
    const promo = await promotionRepo.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Request not found.' });
    if (promo.status !== 'pending') return res.status(400).json({ error: 'Request already reviewed.' });

    const updated = await promotionRepo.review(promo.id, 'rejected', req.user.id);

    await messageService.notifyUser(promo.requesterId, {
        type: 'promotion_request_rejected',
        title: 'Promotion request rejected',
        body: `Your promotion request for user ${promo.targetUserId} was rejected.`,
        link: '/admin/dashboard',
        metadata: { requestId: promo.id },
    });

    return res.json(updated);
});

module.exports = router;

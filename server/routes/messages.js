/**
 * LoopBridge — Messages Routes
 */
'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { messageRepo } = require('../repositories');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    const limit = Number(req.query.limit || 40);
    const messages = await messageRepo.listForUser(req.user.id, limit);
    const unreadCount = await messageRepo.countUnread(req.user.id);
    return res.json({ messages, unreadCount });
});

router.post('/:id/read', requireAuth, async (req, res) => {
    const message = await messageRepo.markRead(req.params.id, req.user.id);
    if (!message) return res.status(404).json({ error: 'Message not found.' });
    const unreadCount = await messageRepo.countUnread(req.user.id);
    return res.json({ message, unreadCount });
});

router.post('/read-all', requireAuth, async (req, res) => {
    await messageRepo.markAllRead(req.user.id);
    return res.json({ ok: true, unreadCount: 0 });
});

module.exports = router;

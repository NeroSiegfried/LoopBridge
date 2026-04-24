/**
 * LoopBridge — Message Service
 */
'use strict';

const { v4: uuidv4 } = require('uuid');
const { messageRepo, userRepo } = require('../repositories');

async function createForUsers(userIds, payload) {
    const unique = [...new Set((userIds || []).filter(Boolean))];
    for (const recipientId of unique) {
        await messageRepo.create({
            id: uuidv4(),
            recipientId,
            type: payload.type || 'system',
            title: payload.title,
            body: payload.body,
            link: payload.link || null,
            metadata: payload.metadata || {},
        });
    }
}

const messageService = {
    async notifyAdmins(payload) {
        const admins = await userRepo.listAdmins();
        await createForUsers(admins.map((user) => user.id), payload);
    },

    async notifyRoots(payload) {
        const roots = await userRepo.listRoots();
        await createForUsers(roots.map((user) => user.id), payload);
    },

    async notifyUser(userId, payload) {
        if (!userId) return;
        await createForUsers([userId], payload);
    },

    async notifyUsers(userIds, payload) {
        await createForUsers(userIds, payload);
    },
};

module.exports = messageService;

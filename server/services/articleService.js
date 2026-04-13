/**
 * LoopBridge — Article Service
 *
 * Business logic for articles: CRUD, soft-delete, restore, auto-categorisation.
 */
'use strict';

const { articleRepo } = require('../repositories');
const { categorise } = require('./categorizationService');

function generateId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 7);
    return `art-${ts}-${rand}`;
}

const articleService = {
    async list(filters) {
        return articleRepo.list(filters);
    },

    async getById(id) {
        return articleRepo.findByIdFormatted(id);
    },

    async create(data, user) {
        const id = generateId();
        const authorName = data.author?.name || user.displayName || 'LoopBridge Team';
        const authorAvatar = data.author?.avatar || user.avatar || null;

        // Auto-categorise if no category provided or set to 'General'/'Auto'
        let category = data.category;
        if (!category || category === 'General' || category === 'Auto') {
            const result = categorise({
                title: data.title,
                description: data.description,
                content: data.content
            });
            category = result.primary;
        }

        return articleRepo.create({
            id,
            title: data.title,
            slug: data.slug,
            description: data.description,
            category,
            image: data.image,
            authorName,
            authorAvatar,
            readTime: data.readTime,
            publishedAt: data.publishedAt,
            featured: data.featured,
            content: data.content
        });
    },

    async update(id, data, user) {
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };

        if (!this._canModify(user, existing)) {
            return { error: 'You do not have permission to modify this item.', status: 403 };
        }

        // Re-categorise if category is unset, 'General', or 'Auto'
        let category = data.category;
        if (!category || category === 'General' || category === 'Auto') {
            const result = categorise({
                title: data.title || existing.title,
                description: data.description || existing.description,
                content: data.content || JSON.parse(existing.content || '[]')
            });
            category = result.primary;
        }

        return articleRepo.update(id, {
            title: data.title,
            slug: data.slug,
            description: data.description,
            category,
            image: data.image,
            authorName: data.author?.name,
            authorAvatar: data.author?.avatar,
            readTime: data.readTime,
            publishedAt: data.publishedAt,
            featured: data.featured,
            content: data.content
        });
    },

    async delete(id, user) {
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };

        if (!this._canModify(user, existing)) {
            return { error: 'You do not have permission to modify this item.', status: 403 };
        }

        await articleRepo.softDelete(id);
        return { ok: true };
    },

    async restore(id, user) {
        if (user.role !== 'admin') {
            return { error: 'Admin only.', status: 403 };
        }
        const result = await articleRepo.restore(id);
        if (!result) return { error: 'Article not found.', status: 404 };
        return result;
    },

    async listForDashboard(user) {
        if (!user) return [];
        if (user.role === 'admin') {
            return articleRepo.list({ includeDeleted: true });
        }
        if (user.role === 'author') {
            const byId = await articleRepo.listByAuthorIds(user.authorOf || []);
            const byName = await articleRepo.listByAuthorName(user.displayName);
            const seen = new Set();
            const merged = [];
            for (const a of [...byId, ...byName]) {
                if (!seen.has(a.id)) {
                    seen.add(a.id);
                    merged.push(a);
                }
            }
            return merged;
        }
        return [];
    },

    /** Check if user can modify item (admin or author-owner) */
    _canModify(user, item) {
        if (user.role === 'admin') return true;
        if (user.role === 'author' && user.authorOf.includes(item.id)) return true;
        return false;
    }
};

module.exports = articleService;

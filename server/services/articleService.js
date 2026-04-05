/**
 * LoopBridge — Article Service
 *
 * Business logic for articles: CRUD, soft-delete, restore.
 */
'use strict';

const { articleRepo } = require('../repositories');

function generateId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 7);
    return `art-${ts}-${rand}`;
}

const articleService = {
    list(filters) {
        return articleRepo.list(filters);
    },

    getById(id) {
        return articleRepo.findByIdFormatted(id);
    },

    create(data, user) {
        const id = generateId();
        const authorName = data.author?.name || user.displayName || 'LoopBridge Team';
        const authorAvatar = data.author?.avatar || user.avatar || null;

        return articleRepo.create({
            id,
            title: data.title,
            slug: data.slug,
            description: data.description,
            category: data.category,
            image: data.image,
            authorName,
            authorAvatar,
            readTime: data.readTime,
            publishedAt: data.publishedAt,
            featured: data.featured,
            content: data.content
        });
    },

    update(id, data, user) {
        const existing = articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };

        if (!this._canModify(user, existing)) {
            return { error: 'You do not have permission to modify this item.', status: 403 };
        }

        return articleRepo.update(id, {
            title: data.title,
            slug: data.slug,
            description: data.description,
            category: data.category,
            image: data.image,
            authorName: data.author?.name,
            authorAvatar: data.author?.avatar,
            readTime: data.readTime,
            publishedAt: data.publishedAt,
            featured: data.featured,
            content: data.content
        });
    },

    delete(id, user) {
        const existing = articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };

        if (!this._canModify(user, existing)) {
            return { error: 'You do not have permission to modify this item.', status: 403 };
        }

        articleRepo.softDelete(id);
        return { ok: true };
    },

    restore(id, user) {
        if (user.role !== 'admin') {
            return { error: 'Admin only.', status: 403 };
        }
        const result = articleRepo.restore(id);
        if (!result) return { error: 'Article not found.', status: 404 };
        return result;
    },

    /**
     * List articles filtered by the user's role:
     *   admin  → all (including deleted)
     *   author → only their own articles
     *   user   → nothing
     */
    listForDashboard(user) {
        if (!user) return [];
        if (user.role === 'admin') {
            return articleRepo.list({ includeDeleted: true });
        }
        if (user.role === 'author') {
            // Return articles the author owns + any matched by display name
            const byId = articleRepo.listByAuthorIds(user.authorOf || []);
            const byName = articleRepo.listByAuthorName(user.displayName);
            // Merge and deduplicate
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

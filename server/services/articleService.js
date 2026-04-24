/**
 * LoopBridge — Article Service
 *
 * Authorization rules:
 *   - Create:     author or admin. New articles start approved=false; admin creates start approved=true.
 *   - Edit:       own content (any role), or admin editing author/user content.
 *                 Admins CANNOT edit/delete another admin's content — only root can.
 *   - Hide/show:  same as edit.
 *   - Approve:    admin only.
 *   - Soft-delete: author (own) or admin (author content only). Another admin's content → root only.
 *   - Hard-delete: root user only. Physically removes the row.
 *   - Restore:    admin only.
 */
'use strict';

const { articleRepo, userRepo } = require('../repositories');
const messageService = require('./messageService');
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
        const authorName  = data.author?.name  || user.displayName || 'LoopBridge Team';
        const authorAvatar = data.author?.avatar || user.avatar || null;

        let category = data.category;
        if (!category || category === 'General' || category === 'Auto') {
            const result = categorise({ title: data.title, description: data.description, content: data.content });
            category = result.primary;
        }

        // Admins' articles go live immediately; authors need admin approval
        const approved = (user.role === 'admin') ? true : false;

        const created = await articleRepo.create({
            id,
            title: data.title,
            slug: data.slug,
            description: data.description,
            category,
            image: data.image,
            authorId: user.id,
            authorName,
            authorAvatar,
            readTime: data.readTime,
            publishedAt: data.publishedAt,
            featured: data.featured,
            hidden: false,
            approved,
            content: data.content
        });

        if (!approved) {
            await messageService.notifyAdmins({
                type: 'article_approval',
                title: 'Article pending approval',
                body: `${authorName} submitted “${created.title}” for review.`,
                link: '/admin/dashboard',
                metadata: { articleId: created.id, authorId: user.id },
            });
        }

        return created;
    },

    async update(id, data, user) {
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'You do not have permission to edit this article.', status: 403 };

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
            title: data.title, slug: data.slug, description: data.description,
            category, image: data.image,
            authorName: data.author?.name, authorAvatar: data.author?.avatar,
            readTime: data.readTime, publishedAt: data.publishedAt,
            featured: data.featured, content: data.content
        });
    },

    async approve(id, user) {
        if (user.role !== 'admin') return { error: 'Admin only.', status: 403 };
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        await articleRepo.setApproved(id, true);
        return articleRepo.findByIdFormatted(id);
    },

    async unapprove(id, user) {
        if (user.role !== 'admin') return { error: 'Admin only.', status: 403 };
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        await articleRepo.setApproved(id, false);
        return articleRepo.findByIdFormatted(id);
    },

    async hide(id, user) {
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };
        await articleRepo.setHidden(id, true);
        return articleRepo.findByIdFormatted(id);
    },

    async unhide(id, user) {
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };
        await articleRepo.setHidden(id, false);
        return articleRepo.findByIdFormatted(id);
    },

    async delete(id, user) {
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };
        await articleRepo.softDelete(id);
        return { ok: true };
    },

    /**
     * Hard delete — permanently remove the row.
     * Only the root user may do this.
     * Rationale: admins can soft-delete (reversible). Physical deletion requires
     * root sign-off for auditability. Root should only hard-delete after confirming
     * the content warrants permanent removal (e.g. legal/compliance order).
     */
    async hardDelete(id, user) {
        if (!user.isRoot) return { error: 'Root administrator access required.', status: 403 };
        const existing = await articleRepo.findById(id);
        if (!existing) return { error: 'Article not found.', status: 404 };
        await articleRepo.hardDelete(id);
        return { ok: true };
    },

    async restore(id, user) {
        if (user.role !== 'admin') return { error: 'Admin only.', status: 403 };
        const result = await articleRepo.restore(id);
        if (!result) return { error: 'Article not found.', status: 404 };
        return result;
    },

    async listForDashboard(user) {
        if (!user) return [];
        if (user.role === 'admin') return articleRepo.list({ includeDeleted: true, includeHidden: true, includeUnapproved: true });
        if (user.role === 'author') {
            const byId   = await articleRepo.listByAuthorId(user.id);
            const byName = await articleRepo.listByAuthorName(user.displayName);
            const seen = new Set();
            const merged = [];
            for (const a of [...byId, ...byName]) {
                if (!seen.has(a.id)) { seen.add(a.id); merged.push(a); }
            }
            return merged;
        }
        return [];
    },

    /**
     * Tiered edit permission check:
     *   root           → always yes
     *   own content    → always yes (author or admin editing their own)
     *   admin          → yes for author/user-owned content; NO for another admin's content
     *   author/user    → no (only own content, handled above)
     */
    async _canEdit(user, item) {
        if (user.isRoot) return true;
        if (item.author_id === user.id) return true;
        if (user.role === 'admin') {
            const author = await userRepo.findById(item.author_id);
            // Block if the content owner is also an admin (or root) — root-only territory
            if (author && author.role === 'admin') return false;
            return true;
        }
        return false;
    }
};

module.exports = articleService;

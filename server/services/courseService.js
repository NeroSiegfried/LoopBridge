/**
 * LoopBridge — Course Service
 *
 * Business logic for courses: CRUD, soft-delete, restore, progress.
 */
'use strict';

const { courseRepo, progressRepo } = require('../repositories');

function generateId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 7);
    return `course-${ts}-${rand}`;
}

const courseService = {
    async list(filters) {
        return courseRepo.list(filters);
    },

    async getById(id) {
        return courseRepo.findByIdFormatted(id);
    },

    async create(data, user) {
        const id = generateId();
        const authorName = data.author?.name || user.displayName || 'LoopBridge Team';
        const authorAvatar = data.author?.avatar || user.avatar || null;

        return courseRepo.create({
            id,
            title: data.title,
            slug: data.slug,
            description: data.description,
            image: data.image,
            authorName,
            authorAvatar,
            duration: data.duration,
            level: data.level,
            track: data.track,
            price: data.price,
            publishedAt: data.publishedAt,
            approved: data.approved,
            topics: data.topics,
            overview: data.overview,
            learningObjectives: data.learningObjectives
        });
    },

    async update(id, data, user) {
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };

        if (!this._canModify(user, existing)) {
            return { error: 'You do not have permission to modify this item.', status: 403 };
        }

        return courseRepo.update(id, {
            title: data.title,
            slug: data.slug,
            description: data.description,
            image: data.image,
            authorName: data.author?.name,
            authorAvatar: data.author?.avatar,
            duration: data.duration,
            level: data.level,
            track: data.track,
            price: data.price,
            publishedAt: data.publishedAt,
            approved: data.approved,
            topics: data.topics,
            overview: data.overview,
            learningObjectives: data.learningObjectives
        });
    },

    async delete(id, user) {
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };

        if (!this._canModify(user, existing)) {
            return { error: 'You do not have permission to modify this item.', status: 403 };
        }

        await courseRepo.softDelete(id);
        return { ok: true };
    },

    async restore(id, user) {
        if (user.role !== 'admin') {
            return { error: 'Admin only.', status: 403 };
        }
        const result = await courseRepo.restore(id);
        if (!result) return { error: 'Course not found.', status: 404 };
        return result;
    },

    async listForDashboard(user) {
        if (!user) return [];
        if (user.role === 'admin') {
            return courseRepo.list({ includeDeleted: true });
        }
        if (user.role === 'author') {
            return courseRepo.listByAuthorName(user.displayName);
        }
        return [];
    },

    // ─── Progress ────────────────────────────────────────
    async getProgress(userId, courseId) {
        return progressRepo.findFormatted(userId, courseId);
    },

    async enroll(userId, courseId) {
        const course = await courseRepo.findById(courseId);
        if (!course) return { error: 'Course not found.', status: 404 };
        return progressRepo.enroll(userId, courseId);
    },

    async updateProgress(userId, courseId, subsectionId, complete) {
        if (!subsectionId) {
            return { error: 'subsectionId is required.', status: 400 };
        }
        return progressRepo.updateCompletedSubs(userId, courseId, subsectionId, complete);
    },

    _canModify(user, item) {
        if (user.role === 'admin') return true;
        if (user.role === 'author' && user.authorOf.includes(item.id)) return true;
        return false;
    }
};

module.exports = courseService;

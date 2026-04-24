/**
 * LoopBridge — Course Service
 *
 * Authorization rules:
 *   - Create:     author or admin. Starts approved=false unless admin creates.
 *   - Edit:       author (own, by author_id) or admin.
 *   - Approve:    admin only.
 *   - Hide/show:  author (own) or admin.
 *   - Soft-delete: author (own) or admin.
 *   - Restore:    admin only.
 *   - Enroll:     any authenticated user. Free courses enroll immediately.
 *                 Paid courses require a confirmed payment first.
 *   - Access content: only enrolled users (and the author/admins).
 */
'use strict';

const { courseRepo, progressRepo, uploadRepo, userRepo } = require('../repositories');

function generateId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 7);
    return `course-${ts}-${rand}`;
}

function extractUploadIdFromMediaUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const normalized = url.trim();
    if (!normalized) return null;

    // Matches both:
    //  - .../transcoded/<uploadId>/stream.m3u8 (AWS)
    //  - .../transcoded/<uploadId>/manifest.m3u8 (local)
    const match = normalized.match(/\/transcoded\/([^/]+)\/(?:stream|manifest)\.m3u8/i);
    return match ? match[1] : null;
}

const courseService = {
    async list(filters) {
        return courseRepo.list(filters);
    },

    async getById(id) {
        const course = await courseRepo.findByIdFormatted(id);
        if (!course) return null;

        // Enrich subsections: look up hlsUrl from upload records if missing
        if (course.topics) {
            for (const topic of course.topics) {
                for (const sub of (topic.subsections || [])) {
                    // Skip if we already have everything we need
                    if (sub.hlsUrl && sub.videoWidth && sub.videoHeight) continue;
                    let upload = null;
                    try {
                        const recoveredUploadId = sub.uploadId
                            || extractUploadIdFromMediaUrl(sub.hlsUrl)
                            || extractUploadIdFromMediaUrl(sub.videoUrl);

                        if (recoveredUploadId) {
                            upload = await uploadRepo.findByIdFormatted(recoveredUploadId);
                        }

                        if (!upload && sub.videoUrl) {
                            upload = await uploadRepo.findByUrl(sub.videoUrl);
                        }

                        if (!upload && sub.hlsUrl) {
                            upload = await uploadRepo.findByUrl(sub.hlsUrl);
                        }
                    } catch (_) { /* ignore */ }
                    if (upload) {
                        if (upload.hlsUrl)      sub.hlsUrl = upload.hlsUrl;
                        if (upload.thumbnailUrl) sub.thumbnailUrl = upload.thumbnailUrl;
                        if (!sub.uploadId)       sub.uploadId = upload.id;
                        if (upload.videoWidth && !sub.videoWidth)  sub.videoWidth  = upload.videoWidth;
                        if (upload.videoHeight && !sub.videoHeight) sub.videoHeight = upload.videoHeight;
                    }
                }
            }
        }
        return course;
    },

    async create(data, user) {
        const id = generateId();
        const authorName  = data.author?.name  || user.displayName || 'LoopBridge Team';
        const authorAvatar = data.author?.avatar || user.avatar || null;
        const slug = data.slug || (data.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const approved = (user.role === 'admin') ? true : false;

        return courseRepo.create({
            id, title: data.title, slug, description: data.description,
            image: data.image, authorId: user.id, authorName, authorAvatar,
            duration: data.duration, level: data.level, track: data.track,
            price: data.price, publishedAt: data.publishedAt,
            approved, topics: data.topics, overview: data.overview,
            learningObjectives: data.learningObjectives
        });
    },

    async update(id, data, user) {
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };
        if (!this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };

        return courseRepo.update(id, {
            title: data.title, slug: data.slug, description: data.description,
            image: data.image, authorName: data.author?.name, authorAvatar: data.author?.avatar,
            duration: data.duration, level: data.level, track: data.track,
            price: data.price, publishedAt: data.publishedAt,
            approved: data.approved, topics: data.topics,
            overview: data.overview, learningObjectives: data.learningObjectives
        });
    },

    async approve(id, user) {
        if (user.role !== 'admin') return { error: 'Admin only.', status: 403 };
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };
        await courseRepo.setApproved(id, true);
        return courseRepo.findByIdFormatted(id);
    },

    async unapprove(id, user) {
        if (user.role !== 'admin') return { error: 'Admin only.', status: 403 };
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };
        await courseRepo.setApproved(id, false);
        return courseRepo.findByIdFormatted(id);
    },

    async hide(id, user) {
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };
        await courseRepo.setHidden(id, true);
        return courseRepo.findByIdFormatted(id);
    },

    async unhide(id, user) {
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };
        await courseRepo.setHidden(id, false);
        return courseRepo.findByIdFormatted(id);
    },

    async delete(id, user) {
        const existing = await courseRepo.findById(id);
        if (!existing) return { error: 'Course not found.', status: 404 };
        if (!await this._canEdit(user, existing)) return { error: 'Permission denied.', status: 403 };
        await courseRepo.softDelete(id);
        return { ok: true };
    },

    async restore(id, user) {
        if (user.role !== 'admin') return { error: 'Admin only.', status: 403 };
        const result = await courseRepo.restore(id);
        if (!result) return { error: 'Course not found.', status: 404 };
        return result;
    },

    async listForDashboard(user) {
        if (!user) return [];
        if (user.role === 'admin') return courseRepo.list({ includeDeleted: true, includeHidden: true, includeUnapproved: true });
        if (user.role === 'author') {
            const byId   = await courseRepo.listByAuthorId(user.id);
            const byName = await courseRepo.listByAuthorName(user.displayName);
            const seen = new Set();
            const merged = [];
            for (const c of [...byId, ...byName]) {
                if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
            }
            return merged;
        }
        return [];
    },

    // ─── Progress & Enrollment ──────────────────────────────────

    async getProgress(userId, courseId) {
        return progressRepo.findFormatted(userId, courseId);
    },

    /**
     * Enroll a user in a course.
     * - Free courses: enroll immediately.
     * - Paid courses: only if a successful payment exists (verified by paymentId param).
     */
    async enroll(userId, courseId, paymentId = null) {
        const course = await courseRepo.findById(courseId);
        if (!course) return { error: 'Course not found.', status: 404 };

        if (course.price > 0) {
            if (!paymentId) {
                return { error: 'This course requires payment before enrollment.', status: 402 };
            }
            // Mark enrollment as paid — paymentService already verified the payment
            return progressRepo.markPaid(userId, courseId, paymentId);
        }

        return progressRepo.enroll(userId, courseId);
    },

    /**
     * Check whether a user is allowed to access course content.
     * Admins and the course author always have access.
     * Regular users need to be enrolled (and paid, if course has a price).
     */
    async canAccessContent(userId, userRole, isRoot, courseId) {
        if (userRole === 'admin' || isRoot) return true;
        const course = await courseRepo.findById(courseId);
        if (!course) return false;
        if (course.author_id === userId) return true;

        const progress = await progressRepo.find(userId, courseId);
        if (!progress) return false;
        if (course.price > 0 && !progress.paid) return false;
        return true;
    },

    async updateProgress(userId, courseId, subsectionId, complete) {
        if (!subsectionId) return { error: 'subsectionId is required.', status: 400 };
        return progressRepo.updateCompletedSubs(userId, courseId, subsectionId, complete);
    },

    /**
     * Tiered edit permission:
     *   root → always yes
     *   own content → yes
     *   admin → yes for author/user content; NO for another admin's content (root only)
     */
    async _canEdit(user, item) {
        if (user.isRoot) return true;
        if (item.author_id === user.id) return true;
        if (user.role === 'admin') {
            const author = await userRepo.findById(item.author_id);
            if (author && author.role === 'admin') return false;
            return true;
        }
        return false;
    }
};

module.exports = courseService;

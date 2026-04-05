/**
 * LoopBridge — Progress Repository
 *
 * Pure data-access for the progress table (course enrollment & completion tracking).
 */
'use strict';

const { getDb } = require('../db');

function rowToProgress(row) {
    if (!row) return null;
    return {
        enrolledAt: row.enrolled_at,
        lastAccessedAt: row.last_accessed_at,
        completedSubs: JSON.parse(row.completed_subs || '[]')
    };
}

const progressRepo = {
    rowToProgress,

    find(userId, courseId) {
        const row = getDb().prepare(
            'SELECT * FROM progress WHERE user_id = ? AND course_id = ?'
        ).get(userId, courseId);
        return row || null;
    },

    findFormatted(userId, courseId) {
        return rowToProgress(this.find(userId, courseId));
    },

    enroll(userId, courseId) {
        const now = new Date().toISOString();
        getDb().prepare(`
            INSERT OR IGNORE INTO progress (user_id, course_id, enrolled_at, last_accessed_at, completed_subs)
            VALUES (?, ?, ?, ?, '[]')
        `).run(userId, courseId, now, now);
        return this.findFormatted(userId, courseId);
    },

    updateCompletedSubs(userId, courseId, subsectionId, complete) {
        const now = new Date().toISOString();

        // Ensure enrolled first
        this.enroll(userId, courseId);

        const row = this.find(userId, courseId);
        let subs = JSON.parse(row.completed_subs || '[]');

        if (complete === false) {
            subs = subs.filter(id => id !== subsectionId);
        } else {
            if (!subs.includes(subsectionId)) {
                subs.push(subsectionId);
            }
        }

        getDb().prepare(
            'UPDATE progress SET completed_subs = ?, last_accessed_at = ? WHERE user_id = ? AND course_id = ?'
        ).run(JSON.stringify(subs), now, userId, courseId);

        return {
            enrolledAt: row.enrolled_at,
            lastAccessedAt: now,
            completedSubs: subs
        };
    },

    listByUser(userId) {
        return getDb().prepare(
            'SELECT * FROM progress WHERE user_id = ? ORDER BY last_accessed_at DESC'
        ).all(userId).map(rowToProgress);
    }
};

module.exports = progressRepo;

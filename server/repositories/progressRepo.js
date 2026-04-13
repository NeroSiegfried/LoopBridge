/**
 * LoopBridge — Progress Repository
 *
 * Pure data-access for the progress table (course enrollment & completion tracking).
 */
'use strict';

const { db } = require('../db');

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

    async find(userId, courseId) {
        return await db.queryRow(
            'SELECT * FROM progress WHERE user_id = ? AND course_id = ?',
            [userId, courseId]);
    },

    async findFormatted(userId, courseId) {
        return rowToProgress(await this.find(userId, courseId));
    },

    async enroll(userId, courseId) {
        const now = new Date().toISOString();
        await db.run(
            `INSERT OR IGNORE INTO progress (user_id, course_id, enrolled_at, last_accessed_at, completed_subs)
             VALUES (?, ?, ?, ?, '[]')`,
            [userId, courseId, now, now]);
        return this.findFormatted(userId, courseId);
    },

    async updateCompletedSubs(userId, courseId, subsectionId, complete) {
        const now = new Date().toISOString();

        // Ensure enrolled first
        await this.enroll(userId, courseId);

        const row = await this.find(userId, courseId);
        let subs = JSON.parse(row.completed_subs || '[]');

        if (complete === false) {
            subs = subs.filter(id => id !== subsectionId);
        } else {
            if (!subs.includes(subsectionId)) {
                subs.push(subsectionId);
            }
        }

        await db.run(
            'UPDATE progress SET completed_subs = ?, last_accessed_at = ? WHERE user_id = ? AND course_id = ?',
            [JSON.stringify(subs), now, userId, courseId]);

        return {
            enrolledAt: row.enrolled_at,
            lastAccessedAt: now,
            completedSubs: subs
        };
    },

    async listByUser(userId) {
        const { rows } = await db.query(
            'SELECT * FROM progress WHERE user_id = ? ORDER BY last_accessed_at DESC',
            [userId]);
        return rows.map(rowToProgress);
    }
};

module.exports = progressRepo;

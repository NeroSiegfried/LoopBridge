/**
 * LoopBridge — FAQ Repository
 *
 * Pure data-access for the faqs table.
 */
'use strict';

const { db } = require('../db');

const faqRepo = {
    async listGrouped() {
        const { rows } = await db.query('SELECT * FROM faqs ORDER BY sort_order ASC');
        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.category]) grouped[row.category] = [];
            grouped[row.category].push({
                id: row.id,
                question: row.question,
                answer: row.answer
            });
        }
        return grouped;
    },

    async listCategories() {
        const { rows } = await db.query('SELECT DISTINCT category FROM faqs ORDER BY sort_order ASC');
        return rows.map(r => r.category);
    }
};

module.exports = faqRepo;

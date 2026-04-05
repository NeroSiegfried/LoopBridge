/**
 * LoopBridge — FAQ Repository
 *
 * Pure data-access for the faqs table.
 */
'use strict';

const { getDb } = require('../db');

const faqRepo = {
    listGrouped() {
        const rows = getDb().prepare('SELECT * FROM faqs ORDER BY sort_order ASC').all();
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

    listCategories() {
        const rows = getDb().prepare('SELECT DISTINCT category FROM faqs ORDER BY sort_order ASC').all();
        return rows.map(r => r.category);
    }
};

module.exports = faqRepo;

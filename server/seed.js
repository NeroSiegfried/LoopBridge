/**
 * LoopBridge — Seed Script
 *
 * Reads the existing JSON data files and populates the SQLite database.
 * Run with: node seed.js
 *
 * Safe to re-run — uses INSERT OR REPLACE.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { getDb, initTables } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`[seed] ${filename} not found — skipping`);
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function seed() {
    initTables();
    const db = getDb();

    // ─── Users ──────────────────────────────────────────
    const usersData = readJSON('users.json');
    if (usersData && usersData.users) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO users
                (id, username, password_hash, display_name, email, role, avatar, author_of)
            VALUES
                (@id, @username, @password_hash, @display_name, @email, @role, @avatar, @author_of)
        `);

        const tx = db.transaction((users) => {
            for (const u of users) {
                const hash = bcrypt.hashSync(u.password, 10);
                stmt.run({
                    id: u.id,
                    username: u.username,
                    password_hash: hash,
                    display_name: u.displayName || '',
                    email: u.email || '',
                    role: u.role || 'user',
                    avatar: u.avatar || null,
                    author_of: JSON.stringify(u.authorOf || [])
                });
            }
        });
        tx(usersData.users);
        console.log(`[seed] Inserted ${usersData.users.length} users`);
    }

    // ─── Articles ───────────────────────────────────────
    const articlesData = readJSON('articles.json');
    if (Array.isArray(articlesData)) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO articles
                (id, title, slug, description, category, image,
                 author_name, author_avatar, read_time,
                 published_at, updated_at, featured, deleted, content)
            VALUES
                (@id, @title, @slug, @description, @category, @image,
                 @author_name, @author_avatar, @read_time,
                 @published_at, @updated_at, @featured, @deleted, @content)
        `);

        const tx = db.transaction((articles) => {
            for (const a of articles) {
                stmt.run({
                    id: a.id,
                    title: a.title,
                    slug: a.slug || null,
                    description: a.description || null,
                    category: a.category || null,
                    image: a.image || null,
                    author_name: a.author ? (typeof a.author === 'string' ? a.author : a.author.name) : null,
                    author_avatar: a.author && typeof a.author === 'object' ? a.author.avatar : null,
                    read_time: a.readTime || null,
                    published_at: a.publishedAt || null,
                    updated_at: a.updatedAt || new Date().toISOString(),
                    featured: a.featured ? 1 : 0,
                    deleted: a.deleted ? 1 : 0,
                    content: JSON.stringify(a.content || [])
                });
            }
        });
        tx(articlesData);
        console.log(`[seed] Inserted ${articlesData.length} articles`);
    }

    // ─── Courses ────────────────────────────────────────
    const coursesData = readJSON('courses.json');
    if (Array.isArray(coursesData)) {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO courses
                (id, title, slug, description, image,
                 author_name, author_avatar, duration, level, track, price,
                 published_at, updated_at, approved, deleted,
                 topics, overview, learning_objectives)
            VALUES
                (@id, @title, @slug, @description, @image,
                 @author_name, @author_avatar, @duration, @level, @track, @price,
                 @published_at, @updated_at, @approved, @deleted,
                 @topics, @overview, @learning_objectives)
        `);

        const tx = db.transaction((courses) => {
            for (const c of courses) {
                stmt.run({
                    id: c.id,
                    title: c.title,
                    slug: c.slug || null,
                    description: c.description || null,
                    image: c.image || null,
                    author_name: c.author ? (typeof c.author === 'string' ? c.author : c.author.name) : null,
                    author_avatar: c.author && typeof c.author === 'object' ? c.author.avatar : null,
                    duration: c.duration || null,
                    level: c.level || null,
                    track: c.track || null,
                    price: c.price || 0,
                    published_at: c.publishedAt || null,
                    updated_at: c.updatedAt || new Date().toISOString(),
                    approved: c.approved !== false ? 1 : 0,
                    deleted: c.deleted ? 1 : 0,
                    topics: JSON.stringify(c.topics || []),
                    overview: c.overview || null,
                    learning_objectives: JSON.stringify(c.learningObjectives || [])
                });
            }
        });
        tx(coursesData);
        console.log(`[seed] Inserted ${coursesData.length} courses`);
    }

    // ─── FAQs ───────────────────────────────────────────
    const faqsData = readJSON('faqs.json');
    if (faqsData && typeof faqsData === 'object') {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO faqs (id, category, question, answer, sort_order)
            VALUES (@id, @category, @question, @answer, @sort_order)
        `);

        let count = 0;
        const tx = db.transaction((faqs) => {
            let order = 0;
            for (const [category, items] of Object.entries(faqs)) {
                for (const faq of items) {
                    stmt.run({
                        id: faq.id,
                        category,
                        question: faq.question,
                        answer: faq.answer,
                        sort_order: order++
                    });
                    count++;
                }
            }
        });
        tx(faqsData);
        console.log(`[seed] Inserted ${count} FAQs`);
    }

    console.log('[seed] Done!');
}

seed().catch(err => {
    console.error('[seed] Error:', err);
    process.exit(1);
});

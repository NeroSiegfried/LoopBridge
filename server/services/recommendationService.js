/**
 * LoopBridge — Recommendation Service
 *
 * Analyses user behaviour (analytics_events, progress, article views) to
 * suggest articles and courses the user is likely to enjoy.
 *
 * Strategy (hybrid — no external AI needed, runs on SQLite):
 *
 *   1. Content-based filtering:
 *      - Which article categories has the user read?  → suggest more from those categories
 *      - Which course tracks/levels?                  → suggest next level, same track
 *
 *   2. Collaborative filtering (lightweight):
 *      - Users who enrolled in Course A also enrolled in Course B
 *      - Users who read Article X also read Article Y
 *
 *   3. Popularity boost:
 *      - Recently popular content gets a slight boost
 *
 *   4. Freshness:
 *      - Newer content scores slightly higher than old content
 *
 * All scoring is numeric (0–100). Results are sorted by composite score.
 */
'use strict';

const { db } = require('../db');
const { articleRepo } = require('../repositories');
const { courseRepo } = require('../repositories');

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

const recommendationService = {

    /**
     * Recommend articles for a user.
     * Returns up to `limit` articles sorted by relevance score.
     */
    async recommendArticles(userId, limit = 10) {
        // 1. Get user's reading history (article_ids from analytics)
        const { rows: readArticles } = await db.query(`
            SELECT DISTINCT article_id
            FROM analytics_events
            WHERE user_id = ? AND article_id IS NOT NULL
              AND event_type IN ('page_view', 'lesson_complete')
            ORDER BY created_at DESC
        `, [userId]);
        const readIds = new Set(readArticles.map(r => r.article_id).filter(Boolean));

        // 2. Get user's category preferences (weighted by view count)
        const { rows: catPrefs } = await db.query(`
            SELECT a.category, COUNT(*) as views
            FROM analytics_events ae
            JOIN articles a ON ae.article_id = a.id
            WHERE ae.user_id = ? AND ae.article_id IS NOT NULL AND a.category IS NOT NULL
            GROUP BY a.category
            ORDER BY views DESC
        `, [userId]);
        const categoryScores = {};
        const maxCatViews = catPrefs[0]?.views || 1;
        for (const row of catPrefs) {
            categoryScores[row.category] = (row.views / maxCatViews) * 40; // max 40 points
        }

        // 3. Collaborative: "users who read what you read also read..."
        const { rows: coArticles } = await db.query(`
            SELECT ae2.article_id, COUNT(DISTINCT ae2.user_id) as co_readers
            FROM analytics_events ae1
            JOIN analytics_events ae2 ON ae1.user_id != ae2.user_id
                AND ae1.article_id = ae2.article_id
                AND ae2.event_type IN ('page_view')
            WHERE ae1.user_id = ? AND ae1.article_id IS NOT NULL
                AND ae2.article_id IS NOT NULL
            GROUP BY ae2.article_id
            ORDER BY co_readers DESC
            LIMIT 50
        `, [userId]);
        const coReaderScores = {};
        const maxCoReaders = coArticles[0]?.co_readers || 1;
        for (const row of coArticles) {
            coReaderScores[row.article_id] = (row.co_readers / maxCoReaders) * 25; // max 25 points
        }

        // 4. Get all published articles
        const allArticles = await articleRepo.list({ includeDeleted: false });

        // 5. Score each unread article
        const now = Date.now();
        const scored = allArticles
            .filter(a => !readIds.has(a.id))
            .map(article => {
                let score = 0;

                // Category match (up to 40 pts)
                if (article.category && categoryScores[article.category]) {
                    score += categoryScores[article.category];
                }

                // Collaborative (up to 25 pts)
                if (coReaderScores[article.id]) {
                    score += coReaderScores[article.id];
                }

                // Popularity — article views (up to 15 pts)
                const views = article.views || 0;
                score += Math.min(15, views * 0.5);

                // Freshness — newer articles score higher (up to 10 pts)
                const ageMs = now - new Date(article.publishedAt || article.createdAt).getTime();
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                score += Math.max(0, 10 - ageDays * 0.1); // decays over 100 days

                // Featured boost (5 pts)
                if (article.featured) score += 5;

                // Small random factor to add variety (up to 5 pts)
                score += Math.random() * 5;

                return { ...article, _score: Math.round(score * 10) / 10 };
            })
            .sort((a, b) => b._score - a._score)
            .slice(0, limit);

        return scored;
    },

    /**
     * Recommend courses for a user.
     * Returns up to `limit` courses sorted by relevance score.
     */
    async recommendCourses(userId, limit = 10) {
        // 1. Get user's enrolled courses
        const { rows: enrolled } = await db.query(`
            SELECT course_id, completed_subs FROM progress WHERE user_id = ?
        `, [userId]);
        const enrolledIds = new Set(enrolled.map(r => r.course_id));

        // Get the actual course details for enrolled ones
        const enrolledCourses = [];
        for (const e of enrolled) {
            const course = await courseRepo.findByIdFormatted(e.course_id);
            if (course) enrolledCourses.push({ ...course, completedSubs: JSON.parse(e.completed_subs || '[]') });
        }

        // 2. Track/level preferences
        const trackPrefs = {};
        const levelPrefs = {};
        for (const c of enrolledCourses) {
            trackPrefs[c.track] = (trackPrefs[c.track] || 0) + 1;
            levelPrefs[c.level] = (levelPrefs[c.level] || 0) + 1;
        }

        // 3. Suggest next level up
        const completedLevels = new Set();
        for (const c of enrolledCourses) {
            const totalSubs = (c.topics || []).reduce((sum, t) => sum + (t.subsections?.length || 0), 0);
            const done = (c.completedSubs || []).length;
            if (totalSubs > 0 && done >= totalSubs * 0.7) {
                completedLevels.add(c.level);
            }
        }

        // 4. Collaborative: "users who enrolled in X also enrolled in Y"
        const { rows: coCourses } = await db.query(`
            SELECT p2.course_id, COUNT(DISTINCT p2.user_id) as co_enrollees
            FROM progress p1
            JOIN progress p2 ON p1.user_id != p2.user_id AND p1.course_id != p2.course_id
                AND p1.user_id = p2.user_id
            WHERE p1.user_id IN (
                SELECT DISTINCT user_id FROM progress WHERE course_id IN (
                    SELECT course_id FROM progress WHERE user_id = ?
                ) AND user_id != ?
            )
            GROUP BY p2.course_id
            ORDER BY co_enrollees DESC
            LIMIT 30
        `, [userId, userId]);
        const coEnrollScores = {};
        const maxCoEnroll = coCourses[0]?.co_enrollees || 1;
        for (const row of coCourses) {
            coEnrollScores[row.course_id] = (row.co_enrollees / maxCoEnroll) * 25;
        }

        // 5. Get all published courses
        const allCourses = await courseRepo.list({ includeDeleted: false });

        // 6. Score each unenrolled course
        const now = Date.now();
        const scored = allCourses
            .filter(c => !enrolledIds.has(c.id))
            .map(course => {
                let score = 0;

                // Track match (up to 30 pts)
                if (course.track && trackPrefs[course.track]) {
                    score += Math.min(30, trackPrefs[course.track] * 15);
                }

                // Next-level bonus (up to 20 pts)
                const courseLevel = course.level || course.track;
                const courseLevelIdx = LEVEL_ORDER.indexOf(courseLevel);
                for (const completedLevel of completedLevels) {
                    const completedIdx = LEVEL_ORDER.indexOf(completedLevel);
                    if (completedIdx >= 0 && courseLevelIdx === completedIdx + 1) {
                        score += 20; // exact next level
                    }
                }

                // Collaborative (up to 25 pts)
                if (coEnrollScores[course.id]) {
                    score += coEnrollScores[course.id];
                }

                // Freshness (up to 10 pts)
                const ageMs = now - new Date(course.publishedAt || course.createdAt).getTime();
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                score += Math.max(0, 10 - ageDays * 0.1);

                // Free courses get a small boost for new users (5 pts)
                if (course.price === 0 && enrolledCourses.length < 2) {
                    score += 5;
                }

                // Random variety (up to 5 pts)
                score += Math.random() * 5;

                return { ...course, _score: Math.round(score * 10) / 10 };
            })
            .sort((a, b) => b._score - a._score)
            .slice(0, limit);

        return scored;
    },

    /**
     * Get category analysis for an article (for the editor UI).
     * Returns all category scores so the author can see suggestions.
     */
    async analyseArticle(article) {
        const { categorise } = require('./categorizationService');
        return categorise(article);
    },

    /**
     * Get a user's interest profile.
     * Returns { topCategories, topTracks, totalArticlesRead, totalCoursesEnrolled, ... }
     */
    async getUserProfile(userId) {
        const { rows: catPrefs } = await db.query(`
            SELECT a.category, COUNT(*) as views
            FROM analytics_events ae
            JOIN articles a ON ae.article_id = a.id
            WHERE ae.user_id = ? AND ae.article_id IS NOT NULL AND a.category IS NOT NULL
            GROUP BY a.category
            ORDER BY views DESC
            LIMIT 5
        `, [userId]);

        const { rows: trackPrefs } = await db.query(`
            SELECT c.track, COUNT(*) as count
            FROM progress p
            JOIN courses c ON p.course_id = c.id
            WHERE p.user_id = ?
            GROUP BY c.track
            ORDER BY count DESC
        `, [userId]);

        const totalArticles = await db.queryRow(`
            SELECT COUNT(DISTINCT article_id) as count
            FROM analytics_events
            WHERE user_id = ? AND article_id IS NOT NULL
        `, [userId]);

        const totalCourses = await db.queryRow(`
            SELECT COUNT(*) as count FROM progress WHERE user_id = ?
        `, [userId]);

        const { rows: recentActivity } = await db.query(`
            SELECT event_type, page, article_id, course_id, created_at
            FROM analytics_events
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `, [userId]);

        return {
            topCategories: catPrefs,
            topTracks: trackPrefs,
            totalArticlesRead: totalArticles?.count || 0,
            totalCoursesEnrolled: totalCourses?.count || 0,
            recentActivity,
        };
    },
};

module.exports = recommendationService;

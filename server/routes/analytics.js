/**
 * LoopBridge — Analytics Routes
 *
 * POST /api/analytics/events       — batch-ingest events from the client
 * GET  /api/analytics/summary      — admin-only: aggregated stats
 * GET  /api/analytics/events       — admin-only: raw event feed (paginated)
 * GET  /api/analytics/export       — admin-only: CSV export for ML pipelines
 *
 * Event types the client sends:
 *   page_view       — every route change
 *   page_exit       — on route leave (duration_ms = time on page)
 *   click           — meaningful CTA / link clicks
 *   course_start    — user starts a course
 *   course_progress — subsection completion
 *   course_complete — all subsections done
 *   lesson_start    — video/reading lesson opened
 *   lesson_complete — video/reading finished
 *   quiz_start      — quiz begun
 *   quiz_submit     — quiz submitted  (score in event.score)
 *   quiz_retry      — quiz retried
 *   search          — search queries
 *   enroll          — course enrolment
 *   scroll_depth    — periodic scroll depth (metadata.depth %)
 */
'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── Ingest (public — session_id from client) ──────────

router.post('/events', async (req, res) => {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    if (events.length === 0 || events.length > 50) {
        return res.status(400).json({ error: 'Send between 1 and 50 events.' });
    }

    try {
        for (const e of events) {
            await db.runNamed(`
                INSERT INTO analytics_events
                    (session_id, user_id, event_type, page, target, course_id, article_id,
                     quiz_id, score, duration_ms, metadata, ip, user_agent, referrer, created_at)
                VALUES
                    (@session_id, @user_id, @event_type, @page, @target, @course_id, @article_id,
                     @quiz_id, @score, @duration_ms, @metadata, @ip, @user_agent, @referrer, datetime('now'))
            `, {
                session_id: e.sessionId || 'unknown',
                user_id: req.user?.id || e.userId || null,
                event_type: e.eventType || e.event_type || 'unknown',
                page: e.page || null,
                target: e.target || null,
                course_id: e.courseId || null,
                article_id: e.articleId || null,
                quiz_id: e.quizId || null,
                score: e.score ?? null,
                duration_ms: e.durationMs ?? e.duration_ms ?? null,
                metadata: typeof e.metadata === 'object' ? JSON.stringify(e.metadata) : (e.metadata || '{}'),
                ip: req.ip || null,
                user_agent: req.get('user-agent') || null,
                referrer: req.get('referer') || e.referrer || null,
            });
        }
        return res.json({ ok: true, count: events.length });
    } catch (err) {
        console.error('[analytics] Insert error:', err.message);
        return res.status(500).json({ error: 'Failed to record events.' });
    }
});

// ─── Admin: summary ─────────────────────────────────────

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
}

router.get('/summary', requireAuth, requireAdmin, async (req, res) => {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const totalEvents = await db.queryRow(
        'SELECT COUNT(*) as count FROM analytics_events WHERE created_at >= ?', [since]);
    const uniqueUsers = await db.queryRow(
        'SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ?', [since]);
    const uniqueSessions = await db.queryRow(
        'SELECT COUNT(DISTINCT session_id) as count FROM analytics_events WHERE created_at >= ?', [since]);
    const { rows: byType } = await db.query(
        'SELECT event_type, COUNT(*) as count FROM analytics_events WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC', [since]);
    const { rows: topPages } = await db.query(
        `SELECT page, COUNT(*) as views, COUNT(DISTINCT session_id) as unique_sessions
         FROM analytics_events WHERE event_type = 'page_view' AND created_at >= ?
         GROUP BY page ORDER BY views DESC LIMIT 20`, [since]);
    const { rows: dailyActivity } = await db.query(
        `SELECT DATE(created_at) as date, COUNT(*) as events, COUNT(DISTINCT session_id) as sessions
         FROM analytics_events WHERE created_at >= ?
         GROUP BY DATE(created_at) ORDER BY date`, [since]);
    const { rows: avgTimeOnPage } = await db.query(
        `SELECT page, ROUND(AVG(duration_ms)/1000.0, 1) as avg_seconds, COUNT(*) as exits
         FROM analytics_events WHERE event_type = 'page_exit' AND duration_ms IS NOT NULL AND created_at >= ?
         GROUP BY page ORDER BY avg_seconds DESC LIMIT 20`, [since]);
    const { rows: quizPerformance } = await db.query(
        `SELECT quiz_id, course_id, ROUND(AVG(score), 1) as avg_score,
                COUNT(*) as attempts, SUM(CASE WHEN score >= 70 THEN 1 ELSE 0 END) as passes
         FROM analytics_events WHERE event_type = 'quiz_submit' AND score IS NOT NULL AND created_at >= ?
         GROUP BY quiz_id, course_id ORDER BY attempts DESC`, [since]);
    const { rows: courseEngagement } = await db.query(
        `SELECT course_id, event_type, COUNT(*) as count
         FROM analytics_events WHERE course_id IS NOT NULL AND created_at >= ?
         GROUP BY course_id, event_type ORDER BY course_id, count DESC`, [since]);

    return res.json({
        period: { days: Number(days), since },
        totalEvents: totalEvents.count,
        uniqueUsers: uniqueUsers.count,
        uniqueSessions: uniqueSessions.count,
        byType,
        topPages,
        dailyActivity,
        avgTimeOnPage,
        quizPerformance,
        courseEngagement,
    });
});

// ─── Admin: raw events (paginated) ──────────────────────

router.get('/events', requireAuth, requireAdmin, async (req, res) => {
    const { limit = 100, offset = 0, type, page: filterPage, userId, courseId, since } = req.query;
    let sql = `SELECT * FROM analytics_events WHERE 1=1`;
    const params = [];

    if (type) { sql += ` AND event_type = ?`; params.push(type); }
    if (filterPage) { sql += ` AND page = ?`; params.push(filterPage); }
    if (userId) { sql += ` AND user_id = ?`; params.push(userId); }
    if (courseId) { sql += ` AND course_id = ?`; params.push(courseId); }
    if (since) { sql += ` AND created_at >= ?`; params.push(since); }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(sql, params);
    const total = await db.queryRow(countSql, params.slice(0, -2));

    return res.json({ events: rows, total: total.count, limit: Number(limit), offset: Number(offset) });
});

// ─── Admin: CSV export for ML pipelines ─────────────────

router.get('/export', requireAuth, requireAdmin, async (req, res) => {
    const { since, type } = req.query;
    let sql = `SELECT * FROM analytics_events WHERE 1=1`;
    const params = [];

    if (since) { sql += ` AND created_at >= ?`; params.push(since); }
    if (type) { sql += ` AND event_type = ?`; params.push(type); }
    sql += ` ORDER BY created_at ASC`;

    const { rows } = await db.query(sql, params);

    if (rows.length === 0) {
        return res.status(200).send('');
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
            const val = r[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(','))
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=loopbridge-analytics-${new Date().toISOString().slice(0,10)}.csv`);
    return res.send(csvLines.join('\n'));
});

module.exports = router;

/**
 * LoopBridge Data Service
 *
 * Provides CRUD operations for articles, courses, FAQs, etc.
 * Communicates with the Express API at /api/*.
 *
 * The public API is identical to the original localStorage-based version
 * so all existing page scripts continue to work without changes.
 *
 * Usage:
 *   const articles = await DataService.getArticles();
 *   const article  = await DataService.getArticle('art-001');
 *   await DataService.createArticle({ title: '...', ... });
 *   await DataService.updateArticle('art-001', { title: 'New Title' });
 *   await DataService.deleteArticle('art-001');
 */
(function () {
    'use strict';

    const API = '/api';

    // ─── HTTP Helpers ───────────────────────────────────────
    async function apiFetch(path, opts = {}) {
        const url = API + path;
        const options = {
            credentials: 'include',          // send session cookie
            headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
            ...opts
        };
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `HTTP ${res.status}`);
            }
            return res.json();
        } catch (err) {
            console.error(`[DataService] ${opts.method || 'GET'} ${url} failed:`, err);
            throw err;
        }
    }

    function apiGet(path)             { return apiFetch(path); }
    function apiPost(path, body)      { return apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }); }
    function apiPut(path, body)       { return apiFetch(path, { method: 'PUT',     body: JSON.stringify(body) }); }
    function apiDelete(path)          { return apiFetch(path, { method: 'DELETE' }); }

    // ─── Articles ───────────────────────────────────────────
    async function getArticles(includeDeleted = false) {
        const qs = includeDeleted ? '?includeDeleted=1' : '';
        return apiGet('/articles' + qs);
    }

    async function getAllArticles() {
        return apiGet('/articles?includeDeleted=1');
    }

    async function getArticle(id) {
        try {
            return await apiGet('/articles/' + id);
        } catch {
            return null;
        }
    }

    async function getArticlesByCategory(category) {
        if (!category || category === 'All' || category === 'All topics') {
            return getArticles();
        }
        return apiGet('/articles?category=' + encodeURIComponent(category));
    }

    async function getFeaturedArticles() {
        return apiGet('/articles?featured=1');
    }

    async function createArticle(articleData) {
        return apiPost('/articles', articleData);
    }

    async function updateArticle(id, updates) {
        return apiPut('/articles/' + id, updates);
    }

    async function deleteArticle(id) {
        return apiDelete('/articles/' + id);
    }

    async function restoreArticle(id) {
        return apiPost('/articles/' + id + '/restore');
    }

    // ─── Courses ────────────────────────────────────────────
    async function getCourses(includeDeleted = false) {
        const qs = includeDeleted ? '?includeDeleted=1' : '';
        return apiGet('/courses' + qs);
    }

    async function getAllCourses() {
        return apiGet('/courses?includeDeleted=1');
    }

    async function getCourse(id) {
        try {
            return await apiGet('/courses/' + id);
        } catch {
            return null;
        }
    }

    async function getCoursesByTrack(track) {
        if (!track || track === 'All') return getCourses();
        return apiGet('/courses?track=' + encodeURIComponent(track));
    }

    async function createCourse(courseData) {
        return apiPost('/courses', courseData);
    }

    async function updateCourse(id, updates) {
        return apiPut('/courses/' + id, updates);
    }

    async function deleteCourse(id) {
        return apiDelete('/courses/' + id);
    }

    async function restoreCourse(id) {
        return apiPost('/courses/' + id + '/restore');
    }

    // ─── FAQs ───────────────────────────────────────────────
    async function getFaqs() {
        return apiGet('/faqs');
    }

    async function getFaqsByCategory(category) {
        const faqs = await getFaqs();
        if (!category || category === 'All') {
            return Object.values(faqs).flat();
        }
        return faqs[category] || [];
    }

    async function getFaqCategories() {
        return apiGet('/faqs/categories');
    }

    // ─── Site Config ────────────────────────────────────────
    async function getSiteConfig() {
        return apiGet('/site');
    }

    // ─── Team ───────────────────────────────────────────────
    async function getTeam() {
        return apiGet('/team');
    }

    // ─── Platforms ──────────────────────────────────────────
    async function getPlatforms() {
        return apiGet('/platforms');
    }

    // ─── Reset (for development) ────────────────────────────
    function resetAll() {
        // Clear any remaining localStorage keys from the old system
        const STORAGE_PREFIX = 'lb_';
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        console.log('[DataService] Local cache cleared.');
    }

    // ─── Course Progress Tracking ───────────────────────────
    // Progress is now server-side. These methods call the API.
    // userId is still accepted for API compatibility but the server
    // determines the user from the session cookie.

    async function getUserProgress(userId) {
        // The server returns all enrolled courses for the session user.
        // We fetch each course's progress individually — or we can
        // just return localStorage fallback for now since the API
        // only exposes per-course progress.
        // For backward compat, keep the localStorage approach for reads
        // until a dedicated /api/progress endpoint exists.
        try {
            const raw = localStorage.getItem('lb_progress');
            const all = raw ? JSON.parse(raw) : {};
            return all[userId] || {};
        } catch {
            return {};
        }
    }

    async function getCourseProgress(userId, courseId) {
        try {
            const data = await apiGet('/courses/' + courseId + '/progress');
            return data;
        } catch {
            // Fall back to localStorage
            const prog = await getUserProgress(userId);
            return prog[courseId] || null;
        }
    }

    async function enrollInCourse(userId, courseId) {
        try {
            return await apiPost('/courses/' + courseId + '/enroll');
        } catch {
            // Fallback: localStorage
            const STORAGE_PREFIX = 'lb_';
            const raw = localStorage.getItem(STORAGE_PREFIX + 'progress');
            const all = raw ? JSON.parse(raw) : {};
            if (!all[userId]) all[userId] = {};
            if (!all[userId][courseId]) {
                all[userId][courseId] = {
                    enrolledAt: new Date().toISOString(),
                    lastAccessedAt: new Date().toISOString(),
                    completedSubs: []
                };
            }
            localStorage.setItem(STORAGE_PREFIX + 'progress', JSON.stringify(all));
            return all[userId][courseId];
        }
    }

    async function markSubsectionComplete(userId, courseId, subsectionId) {
        try {
            return await apiPost('/courses/' + courseId + '/progress', { subsectionId, complete: true });
        } catch {
            return null;
        }
    }

    async function unmarkSubsectionComplete(userId, courseId, subsectionId) {
        try {
            return await apiPost('/courses/' + courseId + '/progress', { subsectionId, complete: false });
        } catch {
            return null;
        }
    }

    function getCourseCompletionPercent(userId, courseId, totalSubsections) {
        // This is called synchronously in some places, so keep localStorage fallback
        try {
            const raw = localStorage.getItem('lb_progress');
            const all = raw ? JSON.parse(raw) : {};
            const prog = all[userId] && all[userId][courseId];
            if (!prog || !totalSubsections) return 0;
            return Math.round((prog.completedSubs.length / totalSubsections) * 100);
        } catch {
            return 0;
        }
    }

    function getUserEnrolledCourses(userId) {
        try {
            const raw = localStorage.getItem('lb_progress');
            const all = raw ? JSON.parse(raw) : {};
            return Object.keys(all[userId] || {});
        } catch {
            return [];
        }
    }

    // ─── Dashboard ────────────────────────────────────────
    async function getDashboard() {
        return apiGet('/dashboard');
    }

    // ─── Public API ─────────────────────────────────────────
    window.DataService = {
        // Articles
        getArticles,
        getAllArticles,
        getArticle,
        getArticlesByCategory,
        getFeaturedArticles,
        createArticle,
        updateArticle,
        deleteArticle,
        restoreArticle,

        // Courses
        getCourses,
        getAllCourses,
        getCourse,
        getCoursesByTrack,
        createCourse,
        updateCourse,
        deleteCourse,
        restoreCourse,

        // FAQs
        getFaqs,
        getFaqsByCategory,
        getFaqCategories,

        // Other
        getSiteConfig,
        getTeam,
        getPlatforms,
        getDashboard,

        // Course Progress
        getUserProgress,
        getCourseProgress,
        enrollInCourse,
        markSubsectionComplete,
        unmarkSubsectionComplete,
        getCourseCompletionPercent,
        getUserEnrolledCourses,

        // Dev
        resetAll
    };
})();

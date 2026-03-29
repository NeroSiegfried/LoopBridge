/**
 * LoopBridge Data Service
 * 
 * Provides CRUD operations for articles, courses, FAQs, etc.
 * Reads from JSON files on first load, then uses localStorage for
 * any user-created/edited/deleted data (mock backend).
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

    const BASE = getBasePath() + 'data/';
    const STORAGE_PREFIX = 'lb_';

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/pages/') || path.includes('/admin/')) {
            return '../';
        }
        return './';
    }

    // ─── Cache ──────────────────────────────────────────────
    const cache = {};

    /**
     * Fetch a JSON file. Returns cached data if available.
     */
    async function fetchJSON(filename) {
        if (cache[filename]) return cache[filename];

        try {
            const res = await fetch(BASE + filename);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            cache[filename] = data;
            return data;
        } catch (err) {
            console.error(`[DataService] Failed to fetch ${filename}:`, err);
            return null;
        }
    }

    // ─── LocalStorage Helpers ───────────────────────────────
    function lsKey(collection) {
        return STORAGE_PREFIX + collection;
    }

    function lsGet(collection) {
        try {
            const raw = localStorage.getItem(lsKey(collection));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function lsSet(collection, data) {
        localStorage.setItem(lsKey(collection), JSON.stringify(data));
    }

    /**
     * Get the "live" array for a collection:
     * If localStorage has overrides, use those. Otherwise load from JSON.
     */
    async function getCollection(collection, filename, extractKey) {
        // Check localStorage first
        const local = lsGet(collection);
        if (local) return local;

        // Fall back to JSON file
        const data = await fetchJSON(filename);
        if (!data) return [];

        // Some JSON files wrap data in a key (e.g., { "articles": [...] })
        const items = extractKey ? data[extractKey] : (Array.isArray(data) ? data : []);
        return items || [];
    }

    /**
     * Save the collection to localStorage (creating a mutable copy).
     */
    function saveCollection(collection, items) {
        lsSet(collection, items);
    }

    /**
     * Generate a unique ID for a new item.
     */
    function generateId(prefix) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 7);
        return `${prefix}-${timestamp}-${random}`;
    }

    // ─── Articles ───────────────────────────────────────────
    async function getArticles(includeDeleted = false) {
        const all = await getCollection('articles', 'articles.json');
        return includeDeleted ? all : all.filter(a => !a.deleted);
    }

    async function getAllArticles() {
        return getCollection('articles', 'articles.json');
    }

    async function getArticle(id) {
        const articles = await getAllArticles();
        return articles.find(a => a.id === id) || null;
    }

    async function getArticlesByCategory(category) {
        const articles = await getArticles();
        if (!category || category === 'All' || category === 'All topics') return articles;
        return articles.filter(a => a.category === category);
    }

    async function getFeaturedArticles() {
        const articles = await getArticles();
        return articles.filter(a => a.featured);
    }

    async function createArticle(articleData) {
        const articles = await getArticles();
        const newArticle = {
            ...articleData,
            id: generateId('art'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        articles.push(newArticle);
        saveCollection('articles', articles);
        return newArticle;
    }

    async function updateArticle(id, updates) {
        const articles = await getAllArticles();
        const index = articles.findIndex(a => a.id === id);
        if (index === -1) throw new Error(`Article "${id}" not found`);

        articles[index] = {
            ...articles[index],
            ...updates,
            id: id, // Prevent ID overwrite
            updatedAt: new Date().toISOString()
        };
        saveCollection('articles', articles);
        return articles[index];
    }

    async function deleteArticle(id) {
        const articles = await getAllArticles();
        const index = articles.findIndex(a => a.id === id);
        if (index === -1) throw new Error(`Article "${id}" not found`);
        // Soft-delete: flag article as deleted
        articles[index].deleted = true;
        articles[index].deletedAt = new Date().toISOString();
        saveCollection('articles', articles);
        return true;
    }

    async function restoreArticle(id) {
        const articles = await getAllArticles();
        const index = articles.findIndex(a => a.id === id);
        if (index === -1) throw new Error(`Article "${id}" not found`);
        delete articles[index].deleted;
        delete articles[index].deletedAt;
        saveCollection('articles', articles);
        return articles[index];
    }

    // ─── Courses ────────────────────────────────────────────
    async function getCourses(includeDeleted = false) {
        const all = await getCollection('courses', 'courses.json');
        return includeDeleted ? all : all.filter(c => !c.deleted && c.approved !== false);
    }

    async function getAllCourses() {
        return getCollection('courses', 'courses.json');
    }

    async function getCourse(id) {
        const courses = await getAllCourses();
        return courses.find(c => c.id === id) || null;
    }

    async function getCoursesByTrack(track) {
        const courses = await getCourses();
        if (!track || track === 'All') return courses;
        return courses.filter(c => c.track === track);
    }

    async function createCourse(courseData) {
        const courses = await getCourses();
        const newCourse = {
            ...courseData,
            id: generateId('course'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        courses.push(newCourse);
        saveCollection('courses', courses);
        return newCourse;
    }

    async function updateCourse(id, updates) {
        const courses = await getAllCourses();
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) throw new Error(`Course "${id}" not found`);

        courses[index] = {
            ...courses[index],
            ...updates,
            id: id,
            updatedAt: new Date().toISOString()
        };
        saveCollection('courses', courses);
        return courses[index];
    }

    async function deleteCourse(id) {
        const courses = await getAllCourses();
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) throw new Error(`Course "${id}" not found`);
        courses[index].deleted = true;
        courses[index].deletedAt = new Date().toISOString();
        saveCollection('courses', courses);
        return true;
    }

    async function restoreCourse(id) {
        const courses = await getAllCourses();
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) throw new Error(`Course "${id}" not found`);
        delete courses[index].deleted;
        delete courses[index].deletedAt;
        saveCollection('courses', courses);
        return courses[index];
    }

    // ─── FAQs ───────────────────────────────────────────────
    async function getFaqs() {
        // FAQs JSON is organized by category (object, not array)
        const local = lsGet('faqs');
        if (local) return local;

        const data = await fetchJSON('faqs.json');
        return data || {};
    }

    async function getFaqsByCategory(category) {
        const faqs = await getFaqs();
        if (!category || category === 'All') {
            // Flatten all categories into one array
            return Object.values(faqs).flat();
        }
        return faqs[category] || [];
    }

    async function getFaqCategories() {
        const faqs = await getFaqs();
        return Object.keys(faqs);
    }

    // ─── Site Config ────────────────────────────────────────
    async function getSiteConfig() {
        return fetchJSON('site.json');
    }

    // ─── Team ───────────────────────────────────────────────
    async function getTeam() {
        const data = await fetchJSON('team.json');
        return data ? data.members : [];
    }

    // ─── Platforms ──────────────────────────────────────────
    async function getPlatforms() {
        const data = await fetchJSON('platforms.json');
        return data ? data.platforms : [];
    }

    // ─── Reset (for development) ────────────────────────────
    function resetAll() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        Object.keys(cache).forEach(key => delete cache[key]);
        console.log('[DataService] All local data cleared.');
    }

    // ─── Course Progress Tracking ───────────────────────────
    /**
     * Progress data structure in localStorage (lb_progress):
     * {
     *   "user-001": {
     *     "course-001": {
     *       enrolledAt: "2024-01-01T00:00:00.000Z",
     *       lastAccessedAt: "2024-01-05T00:00:00.000Z",
     *       completedSubs: ["sub-id-1", "sub-id-2"]
     *     }
     *   }
     * }
     */
    function getAllProgress() {
        return lsGet('progress') || {};
    }

    function saveAllProgress(data) {
        lsSet('progress', data);
    }

    function getUserProgress(userId) {
        const all = getAllProgress();
        return all[userId] || {};
    }

    function getCourseProgress(userId, courseId) {
        const userProg = getUserProgress(userId);
        return userProg[courseId] || null;
    }

    function enrollInCourse(userId, courseId) {
        const all = getAllProgress();
        if (!all[userId]) all[userId] = {};
        if (!all[userId][courseId]) {
            all[userId][courseId] = {
                enrolledAt: new Date().toISOString(),
                lastAccessedAt: new Date().toISOString(),
                completedSubs: []
            };
        }
        saveAllProgress(all);
        return all[userId][courseId];
    }

    function markSubsectionComplete(userId, courseId, subsectionId) {
        const all = getAllProgress();
        if (!all[userId]) all[userId] = {};
        if (!all[userId][courseId]) {
            all[userId][courseId] = {
                enrolledAt: new Date().toISOString(),
                lastAccessedAt: new Date().toISOString(),
                completedSubs: []
            };
        }
        if (!all[userId][courseId].completedSubs.includes(subsectionId)) {
            all[userId][courseId].completedSubs.push(subsectionId);
        }
        all[userId][courseId].lastAccessedAt = new Date().toISOString();
        saveAllProgress(all);
        return all[userId][courseId];
    }

    function unmarkSubsectionComplete(userId, courseId, subsectionId) {
        const all = getAllProgress();
        if (!all[userId] || !all[userId][courseId]) return null;
        all[userId][courseId].completedSubs = all[userId][courseId].completedSubs.filter(id => id !== subsectionId);
        all[userId][courseId].lastAccessedAt = new Date().toISOString();
        saveAllProgress(all);
        return all[userId][courseId];
    }

    function getCourseCompletionPercent(userId, courseId, totalSubsections) {
        const prog = getCourseProgress(userId, courseId);
        if (!prog || !totalSubsections) return 0;
        return Math.round((prog.completedSubs.length / totalSubsections) * 100);
    }

    function getUserEnrolledCourses(userId) {
        const userProg = getUserProgress(userId);
        return Object.keys(userProg);
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

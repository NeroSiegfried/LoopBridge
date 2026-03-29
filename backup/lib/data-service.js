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
    async function getArticles() {
        return getCollection('articles', 'articles.json', 'articles');
    }

    async function getArticle(id) {
        const articles = await getArticles();
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
        const articles = await getArticles();
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
        const articles = await getArticles();
        const filtered = articles.filter(a => a.id !== id);
        if (filtered.length === articles.length) throw new Error(`Article "${id}" not found`);
        saveCollection('articles', filtered);
        return true;
    }

    // ─── Courses ────────────────────────────────────────────
    async function getCourses() {
        return getCollection('courses', 'courses.json', 'courses');
    }

    async function getCourse(id) {
        const courses = await getCourses();
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
        const courses = await getCourses();
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
        const courses = await getCourses();
        const filtered = courses.filter(c => c.id !== id);
        if (filtered.length === courses.length) throw new Error(`Course "${id}" not found`);
        saveCollection('courses', filtered);
        return true;
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

    // ─── Public API ─────────────────────────────────────────
    window.DataService = {
        // Articles
        getArticles,
        getArticle,
        getArticlesByCategory,
        getFeaturedArticles,
        createArticle,
        updateArticle,
        deleteArticle,

        // Courses
        getCourses,
        getCourse,
        getCoursesByTrack,
        createCourse,
        updateCourse,
        deleteCourse,

        // FAQs
        getFaqs,
        getFaqsByCategory,
        getFaqCategories,

        // Other
        getSiteConfig,
        getTeam,
        getPlatforms,

        // Dev
        resetAll
    };
})();

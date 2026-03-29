/**
 * Course Card Component JS
 * 
 * Provides a render function to create course cards from data.
 * 
 * Usage:
 *   const html = CourseCard.render(course, { basePath: '../' });
 *   container.innerHTML = courses.map(c => CourseCard.render(c)).join('');
 */
(function () {
    'use strict';

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/pages/') || path.includes('/admin/')) {
            return '../';
        }
        return './';
    }

    /**
     * Render a course card HTML string.
     */
    function render(course, options = {}) {
        const basePath = options.basePath || getBasePath();
        const showAdmin = options.showAdmin || false;

        const title = Utils ? Utils.escapeHTML(course.title) : course.title;
        const description = Utils
            ? Utils.escapeHTML(Utils.truncate(course.description || '', 100))
            : (course.description || '').substring(0, 100);
        const track = course.track || 'beginner';
        const author = course.author || 'LoopBridge Academy';
        const topicCount = course.topics ? course.topics.length : 0;
        const duration = course.duration || '';
        const thumbnail = course.thumbnail
            ? basePath + course.thumbnail
            : basePath + 'images/placeholder-course.png';
        const courseUrl = basePath + 'pages/course.html?id=' + course.id;

        let adminActions = '';
        if (showAdmin && typeof Auth !== 'undefined' && Auth.canEdit(course.id)) {
            adminActions = `
                <div class="course-card-admin-actions">
                    <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${course.id}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${course.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;
        }

        return `
            <div class="course-card-wrapper" data-course-id="${course.id}" data-track="${track}">
                <a href="${courseUrl}" class="course-card-link">
                    <div class="course-card">
                        <div class="course-card-image">
                            <img src="${thumbnail}" alt="${title}" loading="lazy"
                                 onerror="this.style.display='none'">
                            <span class="course-card-badge badge-${track}">${track}</span>
                        </div>
                        <div class="course-card-body">
                            <h3 class="course-card-title">${title}</h3>
                            <p class="course-card-description">${description}</p>
                            <div class="course-card-meta">
                                <span class="course-card-topics"><i class="fa-solid fa-list"></i> ${topicCount} topics</span>
                                <span class="course-card-duration"><i class="fa-regular fa-clock"></i> ${duration}</span>
                            </div>
                            <div class="course-card-author">
                                <span>By ${author}</span>
                            </div>
                        </div>
                    </div>
                </a>
                ${adminActions}
            </div>
        `;
    }

    /**
     * Render multiple course cards into a container.
     */
    function renderGrid(container, courses, options = {}) {
        if (!container) return;

        if (courses.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center;padding:3rem;color:var(--black-mid);">
                    <i class="fa-solid fa-book-open" style="font-size:2.5rem;margin-bottom:1rem;opacity:0.3;"></i>
                    <p>No courses found.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = courses.map(c => render(c, options)).join('');
    }

    // ─── Public API ─────────────────────────────────────────
    window.CourseCard = {
        render,
        renderGrid
    };
})();

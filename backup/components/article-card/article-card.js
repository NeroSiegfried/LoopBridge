/**
 * Article Card Component JS
 * 
 * Provides a render function to create article cards from data.
 * Can be used by any page that needs to display article cards.
 * 
 * Usage:
 *   const html = ArticleCard.render(article, { basePath: '../', showAdmin: true });
 *   container.innerHTML = articles.map(a => ArticleCard.render(a)).join('');
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
     * Render an article card HTML string.
     * 
     * @param {Object} article - Article data from DataService
     * @param {Object} options - { basePath, showAdmin, onEdit, onDelete }
     * @returns {string} HTML string
     */
    function render(article, options = {}) {
        const basePath = options.basePath || getBasePath();
        const showAdmin = options.showAdmin || false;

        const title = Utils ? Utils.escapeHTML(article.title) : article.title;
        const excerpt = Utils
            ? Utils.escapeHTML(Utils.truncate(article.excerpt || article.description || '', 120))
            : (article.excerpt || article.description || '').substring(0, 120);
        const category = article.category || 'General';
        const author = article.author || 'LoopBridge';
        const readTime = Utils && article.content
            ? Utils.readingTime(article.content)
            : (article.readTime || '5 min read');
        const thumbnail = article.thumbnail
            ? basePath + article.thumbnail
            : basePath + 'images/placeholder-article.png';
        const articleUrl = basePath + 'pages/article.html?id=' + article.id;

        let adminActions = '';
        if (showAdmin && typeof Auth !== 'undefined' && Auth.canEdit(article.id)) {
            adminActions = `
                <div class="article-card-admin-actions">
                    <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${article.id}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${article.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;
        }

        return `
            <div class="article-card-wrapper" data-article-id="${article.id}" data-category="${category}">
                <a href="${articleUrl}" class="article-card-link">
                    <div class="article-card">
                        <div class="article-card-image">
                            <img src="${thumbnail}" alt="${title}" loading="lazy"
                                 onerror="this.style.display='none'">
                            <span class="article-card-category">${category}</span>
                        </div>
                        <div class="article-card-body">
                            <h3 class="article-card-title">${title}</h3>
                            <p class="article-card-excerpt">${excerpt}</p>
                            <div class="article-card-meta">
                                <span class="article-card-author">${author}</span>
                                <span class="article-card-read-time">${readTime}</span>
                            </div>
                        </div>
                    </div>
                </a>
                ${adminActions}
            </div>
        `;
    }

    /**
     * Render multiple article cards into a container.
     * 
     * @param {HTMLElement} container - DOM element to render into
     * @param {Array} articles - Array of article objects
     * @param {Object} options - Render options
     */
    function renderGrid(container, articles, options = {}) {
        if (!container) return;

        if (articles.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align:center;padding:3rem;color:var(--black-mid);">
                    <i class="fa-solid fa-newspaper" style="font-size:2.5rem;margin-bottom:1rem;opacity:0.3;"></i>
                    <p>No articles found.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = articles.map(a => render(a, options)).join('');
    }

    // ─── Public API ─────────────────────────────────────────
    window.ArticleCard = {
        render,
        renderGrid
    };
})();

/**
 * LoopBridge Utilities
 * 
 * Shared helper functions used across the site.
 */
(function () {
    'use strict';

    /**
     * Format an ISO date string to a human-readable format.
     * e.g., "2025-01-15T10:30:00Z" → "January 15, 2025"
     */
    function formatDate(isoString, options) {
        if (!isoString) return '';
        const date = new Date(isoString);
        const defaults = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options || defaults);
    }

    /**
     * Format a relative time string.
     * e.g., "2 days ago", "3 hours ago", "just now"
     */
    function timeAgo(isoString) {
        if (!isoString) return '';
        const now = Date.now();
        const then = new Date(isoString).getTime();
        const diff = now - then;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }

    /**
     * Convert a string to a URL-friendly slug.
     * e.g., "What Is DeFi?" → "what-is-defi"
     */
    function slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Truncate text to a maximum length, adding ellipsis.
     */
    function truncate(text, maxLength = 150) {
        if (!text || text.length <= maxLength) return text || '';
        return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '…';
    }

    /**
     * Calculate estimated reading time from content blocks.
     * Accepts an array of content blocks (from articles.json) or a plain string.
     */
    function readingTime(content) {
        let wordCount = 0;

        if (typeof content === 'string') {
            wordCount = content.split(/\s+/).filter(Boolean).length;
        } else if (Array.isArray(content)) {
            content.forEach(block => {
                if (block.text) {
                    wordCount += block.text.split(/\s+/).filter(Boolean).length;
                }
                if (block.items) {
                    block.items.forEach(item => {
                        wordCount += item.split(/\s+/).filter(Boolean).length;
                    });
                }
            });
        }

        const minutes = Math.max(1, Math.ceil(wordCount / 200));
        return `${minutes} min read`;
    }

    /**
     * Get a URL query parameter by name.
     */
    function getParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    /**
     * Set URL query parameters without page reload.
     */
    function setParam(name, value) {
        const params = new URLSearchParams(window.location.search);
        if (value === null || value === undefined || value === '') {
            params.delete(name);
        } else {
            params.set(name, value);
        }
        const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
    }

    /**
     * Debounce a function call.
     */
    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Escape HTML entities to prevent XSS.
     */
    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Show a toast notification.
     * Types: 'success', 'error', 'info'
     */
    function showToast(message, type = 'info', duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${escapeHTML(message)}</span>
            <button class="toast-dismiss">&times;</button>
        `;

        container.appendChild(toast);

        // Dismiss on click
        toast.querySelector('.toast-dismiss').addEventListener('click', () => {
            toast.remove();
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                toast.style.transition = 'all 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    /**
     * Show a confirmation modal. Returns a Promise<boolean>.
     */
    function confirm(message, title = 'Confirm') {
        return new Promise(resolve => {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h3>${escapeHTML(title)}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <p>${escapeHTML(message)}</p>
                    <div class="modal-footer">
                        <button class="btn btn-ghost modal-cancel">Cancel</button>
                        <button class="btn btn-danger modal-confirm">Confirm</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Animate in
            requestAnimationFrame(() => overlay.classList.add('active'));

            function close(result) {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 250);
                resolve(result);
            }

            overlay.querySelector('.modal-close').onclick = () => close(false);
            overlay.querySelector('.modal-cancel').onclick = () => close(false);
            overlay.querySelector('.modal-confirm').onclick = () => close(true);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    }

    /**
     * Render a loading skeleton in a container.
     * Call with count = number of skeleton cards to show.
     */
    function showSkeletons(container, count = 3, type = 'card') {
        if (!container) return;
        let html = '';

        for (let i = 0; i < count; i++) {
            if (type === 'card') {
                html += `
                    <div class="card" style="pointer-events:none">
                        <div class="skeleton skeleton-image"></div>
                        <div class="card-body">
                            <div class="skeleton skeleton-text" style="width:40%"></div>
                            <div class="skeleton skeleton-title"></div>
                            <div class="skeleton skeleton-text"></div>
                            <div class="skeleton skeleton-text" style="width:70%"></div>
                        </div>
                    </div>
                `;
            } else if (type === 'row') {
                html += `
                    <div style="padding:1rem 0;border-bottom:1px solid var(--gray-mid)">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-text"></div>
                    </div>
                `;
            }
        }

        container.innerHTML = html;
    }

    // ─── Public API ─────────────────────────────────────────
    window.Utils = {
        formatDate,
        timeAgo,
        slugify,
        truncate,
        readingTime,
        getParam,
        setParam,
        debounce,
        escapeHTML,
        showToast,
        confirm,
        showSkeletons
    };
})();

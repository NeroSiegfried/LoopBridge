/**
 * LoopBridge Component Loader
 * 
 * Finds all elements with [data-component], fetches their HTML/CSS/JS,
 * and injects them into the page. Fires 'components-loaded' when done.
 * 
 * Usage:
 *   <div data-component="navbar" data-props='{"activePage":"blog"}'></div>
 *   <script src="../lib/component-loader.js"></script>
 */
(function () {
    'use strict';

    const COMPONENT_BASE = getBasePath() + 'components/';
    const loadedCSS = new Set();
    const loadedJS = new Set();

    /**
     * Determine the base path relative to the current HTML page.
     * Pages in /pages/ or /admin/ need '../', root pages use './'.
     */
    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/pages/') || path.includes('/admin/')) {
            return '../';
        }
        return './';
    }

    /**
     * Load a CSS file by injecting a <link> into <head>.
     * Skips if already loaded.
     */
    function loadCSS(href) {
        if (loadedCSS.has(href)) return Promise.resolve();
        loadedCSS.add(href);

        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = () => {
                // CSS is optional — resolve anyway
                console.warn(`[ComponentLoader] CSS not found: ${href}`);
                resolve();
            };
            document.head.appendChild(link);
        });
    }

    /**
     * Load a JS file by injecting a <script>.
     * Skips if already loaded.
     */
    function loadJS(src) {
        if (loadedJS.has(src)) return Promise.resolve();
        loadedJS.add(src);

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => {
                // JS is optional — resolve anyway
                console.warn(`[ComponentLoader] JS not found: ${src}`);
                resolve();
            };
            document.body.appendChild(script);
        });
    }

    /**
     * Fetch the HTML template for a component.
     */
    async function fetchHTML(name) {
        const url = COMPONENT_BASE + name + '/' + name + '.html';
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (err) {
            console.error(`[ComponentLoader] Failed to load HTML for "${name}":`, err);
            return '';
        }
    }

    /**
     * Parse props from data-props attribute (JSON string).
     */
    function getProps(el) {
        const raw = el.getAttribute('data-props');
        if (!raw) return {};
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.warn(`[ComponentLoader] Invalid data-props on`, el, e);
            return {};
        }
    }

    /**
     * Simple template interpolation: replaces {{key}} with props[key].
     */
    function interpolate(html, props) {
        return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return props[key] !== undefined ? props[key] : match;
        });
    }

    /**
     * Load a single component into its host element.
     */
    async function loadComponent(el) {
        const name = el.getAttribute('data-component');
        if (!name) return;

        const props = getProps(el);

        // Load CSS first (non-blocking but before paint)
        const cssPath = COMPONENT_BASE + name + '/' + name + '.css';
        await loadCSS(cssPath);

        // Fetch and inject HTML
        let html = await fetchHTML(name);
        html = interpolate(html, props);
        el.innerHTML = html;

        // Store props on the element for JS to access
        el._componentProps = props;
        el.setAttribute('data-component-loaded', 'true');

        // Load JS last (after DOM is populated)
        const jsPath = COMPONENT_BASE + name + '/' + name + '.js';
        await loadJS(jsPath);
    }

    /**
     * Initialize: find all [data-component] elements and load them.
     */
    async function init() {
        const elements = document.querySelectorAll('[data-component]');
        if (elements.length === 0) return;

        // Load all components in parallel
        await Promise.all(Array.from(elements).map(loadComponent));

        // Fire custom event so page scripts know components are ready
        document.dispatchEvent(new CustomEvent('components-loaded', {
            detail: { count: elements.length }
        }));
    }

    // Auto-initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for manual use
    window.ComponentLoader = {
        load: loadComponent,
        init: init,
        getBasePath: getBasePath
    };
})();

/**
 * LoopBridge Auth Service
 *
 * API-backed authentication with login/logout, role checks,
 * and ownership verification. Session is managed server-side
 * via an httpOnly cookie; a localStorage cache keeps getCurrentUser()
 * synchronous for existing code that depends on it.
 *
 * Roles: admin, author, user
 *
 * Usage:
 *   await Auth.login('admin', 'admin123');
 *   const user = Auth.getCurrentUser();
 *   Auth.isAdmin();
 *   Auth.isAuthor();
 *   Auth.canEdit('art-001');
 *   await Auth.logout();
 */
(function () {
    'use strict';

    const SESSION_KEY = 'lb_session';  // localStorage cache key
    const API = '/api/auth';

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/pages/') || path.includes('/admin/')) {
            return '../';
        }
        return './';
    }

    // ─── API Helpers ────────────────────────────────────────
    async function apiFetch(path, opts = {}) {
        const url = API + path;
        const options = {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
            ...opts
        };
        const res = await fetch(url, options);
        return res.json();
    }

    // ─── Login ──────────────────────────────────────────────
    /**
     * Login with username and password.
     * Returns the user object on success, null on failure.
     */
    async function login(username, password) {
        try {
            const res = await fetch(API + '/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) return null;

            const user = await res.json();
            // Cache in localStorage for synchronous access
            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            return user;
        } catch (err) {
            console.error('[Auth] Login failed:', err);
            return null;
        }
    }

    // ─── Logout ─────────────────────────────────────────────
    async function logout() {
        try {
            await fetch(API + '/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch {
            // silent
        }
        localStorage.removeItem(SESSION_KEY);
    }

    // ─── Session Check ──────────────────────────────────────
    /**
     * Verify session with the server and update localStorage cache.
     * Call this once on page load (e.g. after components-loaded).
     */
    async function checkSession() {
        try {
            const data = await apiFetch('/session');
            if (data.user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
                return data.user;
            } else {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
        } catch {
            return getCurrentUser(); // fall back to cache
        }
    }

    // ─── Synchronous Getters (from localStorage cache) ─────
    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function isLoggedIn() {
        return getCurrentUser() !== null;
    }

    function isAdmin() {
        const user = getCurrentUser();
        return user && user.role === 'admin';
    }

    function isAuthor() {
        const user = getCurrentUser();
        return user && (user.role === 'author' || user.role === 'admin');
    }

    function canEdit(itemId) {
        const user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'admin') return true;
        if (user.role === 'author' && user.authorOf) {
            return user.authorOf.includes(itemId);
        }
        return false;
    }

    function canDelete(itemId) {
        return canEdit(itemId);
    }

    // ─── Guards ─────────────────────────────────────────────
    function requireAuth(redirectUrl) {
        const user = getCurrentUser();
        if (!user) {
            const loginPage = getBasePath() + 'admin/login.html';
            const returnTo = redirectUrl || window.location.href;
            window.location.href = loginPage + '?return=' + encodeURIComponent(returnTo);
            return null;
        }
        return user;
    }

    function requireAdmin() {
        const user = requireAuth();
        if (user && user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = getBasePath() + 'index.html';
            return null;
        }
        return user;
    }

    // ─── Render Auth UI (legacy helper) ─────────────────────
    function renderAuthUI(container) {
        if (!container) return;

        const user = getCurrentUser();

        if (user) {
            container.innerHTML = `
                <div class="auth-user-info">
                    <span class="auth-display-name">${user.displayName}</span>
                    <span class="auth-role badge badge-${user.role === 'admin' ? 'advanced' : user.role === 'author' ? 'intermediate' : 'beginner'}">${user.role}</span>
                    <button class="btn btn-sm btn-ghost auth-logout-btn">Logout</button>
                </div>
            `;
            container.querySelector('.auth-logout-btn').addEventListener('click', async () => {
                await logout();
                window.location.reload();
            });
        } else {
            container.innerHTML = `
                <a href="${getBasePath()}admin/login.html" class="btn btn-sm btn-primary">Login</a>
            `;
        }
    }

    // ─── Auto-verify session on load ────────────────────────
    // Fire-and-forget: validates the cookie with the server and
    // updates the localStorage cache. Doesn't block rendering.
    if (typeof window !== 'undefined') {
        checkSession().catch(() => {});
    }

    // ─── Public API ─────────────────────────────────────────
    window.Auth = {
        login,
        logout,
        checkSession,
        getCurrentUser,
        isLoggedIn,
        isAdmin,
        isAuthor,
        canEdit,
        canDelete,
        requireAuth,
        requireAdmin,
        renderAuthUI
    };
})();

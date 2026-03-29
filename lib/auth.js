/**
 * LoopBridge Auth Service (Mock)
 * 
 * Provides mock authentication with login/logout, role checks,
 * and ownership verification. Uses localStorage for session persistence.
 * 
 * Roles: admin, author, user
 * 
 * Usage:
 *   await Auth.login('admin', 'admin123');
 *   const user = Auth.getCurrentUser();
 *   Auth.isAdmin();         // true if role === 'admin'
 *   Auth.isAuthor();        // true if role === 'author' or 'admin'
 *   Auth.canEdit('art-001'); // true if admin or owner of that article
 *   Auth.logout();
 */
(function () {
    'use strict';

    const SESSION_KEY = 'lb_session';
    const USERS_CACHE_KEY = '_auth_users';

    let usersCache = null;

    function getBasePath() {
        const path = window.location.pathname;
        if (path.includes('/pages/') || path.includes('/admin/')) {
            return '../';
        }
        return './';
    }

    /**
     * Load users from JSON (cached after first load).
     */
    async function loadUsers() {
        if (usersCache) return usersCache;

        try {
            const res = await fetch(getBasePath() + 'data/users.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            usersCache = data.users || [];
            return usersCache;
        } catch (err) {
            console.error('[Auth] Failed to load users:', err);
            return [];
        }
    }

    /**
     * Login with username and password.
     * Returns the user object (without password) on success, null on failure.
     */
    async function login(username, password) {
        const users = await loadUsers();
        const user = users.find(
            u => u.username === username && u.password === password
        );

        if (!user) return null;

        // Store session (exclude password)
        const session = { ...user };
        delete session.password;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));

        return session;
    }

    /**
     * Logout the current user.
     */
    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    /**
     * Get the currently logged-in user, or null.
     */
    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /**
     * Check if anyone is logged in.
     */
    function isLoggedIn() {
        return getCurrentUser() !== null;
    }

    /**
     * Check if current user has admin role.
     */
    function isAdmin() {
        const user = getCurrentUser();
        return user && user.role === 'admin';
    }

    /**
     * Check if current user has author or admin role.
     */
    function isAuthor() {
        const user = getCurrentUser();
        return user && (user.role === 'author' || user.role === 'admin');
    }

    /**
     * Check if current user can edit an article/course.
     * Admins can edit anything. Authors can edit items they own.
     */
    function canEdit(itemId) {
        const user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'admin') return true;
        if (user.role === 'author' && user.authorOf) {
            return user.authorOf.includes(itemId);
        }
        return false;
    }

    /**
     * Check if current user can delete an item.
     * Only admins can delete; authors can delete their own.
     */
    function canDelete(itemId) {
        return canEdit(itemId); // Same permission model
    }

    /**
     * Require login — redirects to login page if not logged in.
     * Returns the current user if logged in.
     */
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

    /**
     * Require admin role — redirects if not admin.
     */
    function requireAdmin() {
        const user = requireAuth();
        if (user && user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = getBasePath() + 'index.html';
            return null;
        }
        return user;
    }

    /**
     * Render a login/logout UI element.
     * Pass a container element; it will be populated with user info or login button.
     */
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
            container.querySelector('.auth-logout-btn').addEventListener('click', () => {
                logout();
                window.location.reload();
            });
        } else {
            container.innerHTML = `
                <a href="${getBasePath()}admin/login.html" class="btn btn-sm btn-primary">Login</a>
            `;
        }
    }

    // ─── Public API ─────────────────────────────────────────
    window.Auth = {
        login,
        logout,
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

/**
 * Navbar Component JS
 * 
 * Handles mobile menu toggle with border-radius animation,
 * push-down offset, and active page highlighting.
 */
(function () {
    'use strict';

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');
    if (!mobileMenuBtn || !navMenu) return;

    const menuIcon = mobileMenuBtn.querySelector('i');
    const navContainer = document.querySelector('.nav-container');
    const navbar = document.querySelector('.navbar');
    // The <nav> lives inside a <div data-component="navbar"> wrapper,
    // so we need the wrapper's nextElementSibling, not the nav's.
    const navHost = navbar ? navbar.closest('[data-component="navbar"]') : null;
    const firstBelowNav = navHost ? navHost.nextElementSibling : (navbar ? navbar.nextElementSibling : null);

    // ─── Active page highlighting ───────────────────────────
    const host = document.querySelector('[data-component="navbar"]');
    const activePage = host && host._componentProps ? host._componentProps.activePage : '';

    if (activePage) {
        const links = navMenu.querySelectorAll('.nav-links a[data-page]');
        links.forEach(link => {
            if (link.getAttribute('data-page') === activePage) {
                link.classList.add('active');
            }
        });
    }

    // ─── Auth UI ────────────────────────────────────────────
    const userSlot = document.getElementById('nav-user-slot');
    const joinBtn = document.getElementById('nav-join-btn');
    const navLinks = navMenu.querySelector('.nav-links');
    const navRightControls = document.querySelector('.nav-right-controls');

    // Track elements injected for mobile auth so we can clean them up
    let mobileAuthSeparator = null;
    let mobileAuthLinks = [];

    function renderAuthUI() {
        if (!userSlot) return;
        if (typeof Auth === 'undefined') return;

        // Clean up previously injected mobile auth elements
        cleanupMobileAuth();

        const user = Auth.getCurrentUser();
        if (!user) {
            userSlot.innerHTML = '';
            if (joinBtn) joinBtn.style.display = '';
            return;
        }

        // Hide join button when logged in
        if (joinBtn) joinBtn.style.display = 'none';

        const initials = (user.name || user.email || 'U')
            .split(' ')
            .map(w => w[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

        const basePath = (host && host._componentProps) ? host._componentProps.basePath || './' : './';

        // Desktop: full auth UI in nav-user slot (hidden on mobile via CSS)
        userSlot.innerHTML = `
            <div class="auth-user-info" id="auth-user-toggle">
                <div class="auth-avatar">${initials}</div>
                <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;margin-left:0.25rem;color:#999;"></i>
            </div>
            <div class="auth-dropdown" id="auth-dropdown">
                <div class="auth-dropdown-name">${Utils.escapeHTML(user.name || user.email)}</div>
                ${(user.role === 'admin' || user.role === 'author') ? `<a href="${basePath}admin/dashboard.html">Dashboard</a>` : ''}
                ${(user.role === 'admin' || user.role === 'author') ? `<a href="${basePath}admin/edit-article.html">New Article</a>` : ''}
                ${(user.role === 'admin' || user.role === 'author') ? `<a href="${basePath}admin/edit-course.html">New Course</a>` : ''}
                <button class="logout-btn" id="auth-logout-btn">Log out</button>
            </div>
        `;

        // Mobile: avatar into .nav-right-controls, auth links into .nav-links
        setupMobileAuth(user, initials, basePath);

        // Desktop dropdown toggle
        const toggle = document.getElementById('auth-user-toggle');
        const dropdown = document.getElementById('auth-dropdown');

        if (toggle && dropdown) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isMobile = window.matchMedia('(max-width: 62rem)').matches;
                if (isMobile) return;
                dropdown.classList.toggle('open');
            });

            document.addEventListener('click', () => {
                dropdown.classList.remove('open');
            });

            dropdown.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                    dropdown.classList.remove('open');
                }
            });
        }

        // Desktop logout
        const logoutBtn = document.getElementById('auth-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                Auth.logout();
                window.location.reload();
            });
        }
    }

    function setupMobileAuth(user, initials, basePath) {
        if (!navLinks || !navRightControls) return;

        // Place avatar in .nav-right-controls before menu-toggle
        const avatarEl = document.createElement('div');
        avatarEl.className = 'mobile-auth-avatar auth-avatar';
        avatarEl.textContent = initials;
        navRightControls.insertBefore(avatarEl, mobileMenuBtn);

        // Add a separator <hr> inside .nav-links
        mobileAuthSeparator = document.createElement('hr');
        mobileAuthSeparator.className = 'nav-auth-separator';
        navLinks.appendChild(mobileAuthSeparator);

        // Add auth links directly into .nav-links (same styling as other nav links)
        const authLinkData = [];
        if (user.role === 'admin' || user.role === 'author') {
            authLinkData.push({ href: `${basePath}admin/dashboard.html`, text: 'Dashboard' });
            authLinkData.push({ href: `${basePath}admin/edit-article.html`, text: 'New Article' });
            authLinkData.push({ href: `${basePath}admin/edit-course.html`, text: 'New Course' });
        }

        authLinkData.forEach(item => {
            const a = document.createElement('a');
            a.href = item.href;
            a.textContent = item.text;
            a.className = 'mobile-auth-link';
            navLinks.appendChild(a);
            mobileAuthLinks.push(a);
        });

        // Log out link
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.textContent = 'Log out';
        logoutLink.className = 'mobile-auth-link mobile-auth-logout';
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
            window.location.reload();
        });
        navLinks.appendChild(logoutLink);
        mobileAuthLinks.push(logoutLink);
    }

    function cleanupMobileAuth() {
        // Remove avatar from nav-right-controls
        if (navRightControls) {
            const avatar = navRightControls.querySelector('.mobile-auth-avatar');
            if (avatar) avatar.remove();
        }
        // Remove separator
        if (mobileAuthSeparator && mobileAuthSeparator.parentNode) {
            mobileAuthSeparator.remove();
            mobileAuthSeparator = null;
        }
        // Remove auth links from nav-links
        mobileAuthLinks.forEach(el => {
            if (el.parentNode) el.remove();
        });
        mobileAuthLinks = [];
    }

    renderAuthUI();

    // Listen for auth changes
    window.addEventListener('auth-changed', renderAuthUI);

    // ─── Push-down offset calculation ───────────────────────
    function updatePageOffset() {
        if (!firstBelowNav) return;

        const isMobile = window.matchMedia('(max-width: 62rem)').matches;
        firstBelowNav.style.transition = 'padding-top 0.35s ease';

        if (!isMobile || !navMenu.classList.contains('active')) {
            firstBelowNav.style.paddingTop = '';
            return;
        }

        // Read the original CSS padding by clearing inline override
        firstBelowNav.style.paddingTop = '';
        const originalPaddingTop = parseFloat(getComputedStyle(firstBelowNav).paddingTop);

        // Menu height: scrollHeight + padding already accounted via scrollHeight + borders
        const menuStyle = getComputedStyle(navMenu);
        const menuHeight = navMenu.scrollHeight
            + 48
            + parseFloat(menuStyle.borderTopWidth)
            + parseFloat(menuStyle.borderBottomWidth);

        firstBelowNav.style.paddingTop = (originalPaddingTop + menuHeight) + 'px';
    }

    // ─── Mobile menu toggle ─────────────────────────────────
    const clickTarget = navRightControls || mobileMenuBtn;
    clickTarget.addEventListener('click', (e) => {
        // Prevent the avatar from triggering its own transform;
        // only the menu icon should animate bars↔xmark
        const isActive = navMenu.classList.contains('active');

        // Close the auth dropdown when toggling mobile menu
        const authDropdown = document.getElementById('auth-dropdown');
        if (authDropdown) authDropdown.classList.remove('open');

        if (isActive) {
            // Close: retract menu immediately
            navMenu.classList.remove('active');
            menuIcon.classList.remove('fa-xmark');
            menuIcon.classList.add('fa-bars');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            updatePageOffset();

            // Restore border-radius after menu retracts (ease-out)
            setTimeout(() => {
                navContainer.style.transition = 'border-radius 0.15s ease-out';
                navContainer.style.borderBottomLeftRadius = '';
                navContainer.style.borderBottomRightRadius = '';
            }, 350);
        } else {
            // Open: flatten corners first (ease-in), then expand menu
            navContainer.style.transition = 'border-radius 0.15s ease-in';
            navContainer.style.borderBottomLeftRadius = '0';
            navContainer.style.borderBottomRightRadius = '0';

            setTimeout(() => {
                navMenu.classList.add('active');
                mobileMenuBtn.setAttribute('aria-expanded', 'true');
                updatePageOffset();
            }, 150);

            menuIcon.classList.remove('fa-bars');
            menuIcon.classList.add('fa-xmark');
        }
    });

    // Restore on resize to desktop
    window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 62rem)').matches && firstBelowNav) {
            firstBelowNav.style.paddingTop = '';
            firstBelowNav.style.transition = '';
        }
    });
})();

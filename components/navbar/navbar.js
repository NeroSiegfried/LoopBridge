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

    function renderAuthUI() {
        if (!userSlot) return;
        if (typeof Auth === 'undefined') return;

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

        userSlot.innerHTML = `
            <div class="auth-user-info" id="auth-user-toggle">
                <div class="auth-avatar">${initials}</div>
                <span class="auth-display-name">${user.name || user.email}</span>
                <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;margin-left:0.25rem;color:#999;"></i>
            </div>
            <div class="auth-dropdown" id="auth-dropdown">
                ${(user.role === 'admin' || user.role === 'author') ? `<a href="${basePath}admin/dashboard.html">Dashboard</a>` : ''}
                ${(user.role === 'admin' || user.role === 'author') ? `<a href="${basePath}admin/edit-article.html">New Article</a>` : ''}
                ${(user.role === 'admin' || user.role === 'author') ? `<a href="${basePath}admin/edit-course.html">New Course</a>` : ''}
                <button class="logout-btn" id="auth-logout-btn">Log out</button>
            </div>
        `;

        // Toggle dropdown
        const toggle = document.getElementById('auth-user-toggle');
        const dropdown = document.getElementById('auth-dropdown');

        if (toggle && dropdown) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                // On mobile, dropdown is always visible (position: static), so skip toggle
                const isMobile = window.matchMedia('(max-width: 62rem)').matches;
                if (isMobile) return;
                dropdown.classList.toggle('open');
            });

            document.addEventListener('click', () => {
                dropdown.classList.remove('open');
            });

            // Close dropdown when clicking inside it (navigation clicks)
            dropdown.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                    dropdown.classList.remove('open');
                }
            });
        }

        // Logout
        const logoutBtn = document.getElementById('auth-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                Auth.logout();
                window.location.reload();
            });
        }
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
    mobileMenuBtn.addEventListener('click', () => {
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

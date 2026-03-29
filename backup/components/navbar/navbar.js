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
    const firstBelowNav = navbar ? navbar.nextElementSibling : null;

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
    if (typeof Auth !== 'undefined') {
        const authContainer = document.createElement('div');
        authContainer.className = 'nav-auth';
        navMenu.appendChild(authContainer);
        Auth.renderAuthUI(authContainer);
    }

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

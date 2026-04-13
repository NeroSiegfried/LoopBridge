import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/navbar.css';

export default function Navbar() {
  const { user, logout, isAuthor } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navContainerRef = useRef(null);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
    // Restore border-radius that handleMenuToggle flattened
    const navContainer = navContainerRef.current;
    if (navContainer) {
      setTimeout(() => {
        navContainer.style.transition = 'border-radius 0.15s ease-out';
        navContainer.style.borderBottomLeftRadius = '';
        navContainer.style.borderBottomRightRadius = '';
      }, 350);
    }
  }, [location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ─── Push-down offset ─────────────────────────────────────
  // Runs AFTER React has rendered (so .active class is on the DOM)
  useEffect(() => {
    const navContainer = navContainerRef.current;
    if (!navContainer) return;
    const navbar = navContainer.parentElement; // <nav class="navbar">
    if (!navbar) return;
    const firstBelowNav = navbar.nextElementSibling;
    if (!firstBelowNav) return;

    const navMenu = navContainer.querySelector('.nav-menu');
    if (!navMenu) return;

    firstBelowNav.style.transition = 'padding-top 0.35s ease';

    if (!menuOpen) {
      firstBelowNav.style.paddingTop = '';
      return;
    }

    // Read the original CSS padding by clearing inline override first
    firstBelowNav.style.paddingTop = '';
    const originalPaddingTop = parseFloat(getComputedStyle(firstBelowNav).paddingTop) || 0;

    // Wait a frame so max-height transition starts and scrollHeight is accurate
    requestAnimationFrame(() => {
      const menuStyle = getComputedStyle(navMenu);
      const menuHeight = navMenu.scrollHeight
        + 48
        + parseFloat(menuStyle.borderTopWidth || 0)
        + parseFloat(menuStyle.borderBottomWidth || 0);

      firstBelowNav.style.paddingTop = (originalPaddingTop + menuHeight) + 'px';
    });
  }, [menuOpen]);

  // Handle resize: clear offset on desktop
  useEffect(() => {
    const handler = () => {
      if (!window.matchMedia('(max-width: 62rem)').matches) {
        const navContainer = navContainerRef.current;
        if (!navContainer) return;
        const navbar = navContainer.parentElement;
        if (!navbar) return;
        const firstBelowNav = navbar.nextElementSibling;
        if (firstBelowNav) {
          firstBelowNav.style.paddingTop = '';
          firstBelowNav.style.transition = '';
        }
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  function handleMenuToggle() {
    const navContainer = navContainerRef.current;
    if (!navContainer) return;
    setDropdownOpen(false);

    if (menuOpen) {
      // Close: retract menu, then restore border-radius
      setMenuOpen(false);
      setTimeout(() => {
        navContainer.style.transition = 'border-radius 0.15s ease-out';
        navContainer.style.borderBottomLeftRadius = '';
        navContainer.style.borderBottomRightRadius = '';
      }, 350);
    } else {
      // Open: flatten corners first, then expand menu
      navContainer.style.transition = 'border-radius 0.15s ease-in';
      navContainer.style.borderBottomLeftRadius = '0';
      navContainer.style.borderBottomRightRadius = '0';
      setTimeout(() => {
        setMenuOpen(true);
      }, 150);
    }
  }

  const initials = user
    ? (user.displayName || user.username || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '';

  return (
    <nav className="navbar">
      <div className="nav-container" ref={navContainerRef}>
        <div className="logo">
          <Link to="/">
            <img src="/images/logos/LB text no symbol black 2.png" alt="LoopBridge Logo" className="logo" />
          </Link>
        </div>

        <div className="nav-right-controls">
          {user && <div className="mobile-auth-avatar auth-avatar">{initials}</div>}
          <button
            className="menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={handleMenuToggle}
          >
            <i className={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'} />
          </button>
        </div>

        <div className={`nav-menu${menuOpen ? ' active' : ''}`} role="navigation">
          <div className="nav-links">
            <NavLink to="/academy" className="nav-link-hover">Academy</NavLink>
            <NavLink to="/exchange" className="nav-link-hover">Exchange</NavLink>
            <NavLink to="/community" className="nav-link-hover">Community</NavLink>
            <NavLink to="/about" className="nav-link-hover">About</NavLink>
            <NavLink to="/blog" className="nav-link-hover">Blog</NavLink>
            <NavLink to="/faqs" className="nav-link-hover">FAQs</NavLink>

            {user && (
              <>
                <hr className="nav-auth-separator" />
                {isAuthor && <Link to="/admin/dashboard" className="mobile-auth-link">Dashboard</Link>}
                {isAuthor && <Link to="/admin/edit-article" className="mobile-auth-link">New Article</Link>}
                {isAuthor && <Link to="/admin/edit-course" className="mobile-auth-link">New Course</Link>}
                <button className="mobile-auth-link mobile-auth-logout" onClick={() => { logout(); setMenuOpen(false); }}>Log out</button>
              </>
            )}
          </div>

          {user && (
            <div className="nav-user" ref={dropdownRef}>
              <div className="auth-user-info" onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}>
                <div className="auth-avatar">{initials}</div>
              </div>
              <div className={`auth-dropdown${dropdownOpen ? ' open' : ''}`}>
                <div className="auth-dropdown-name">{user.displayName || user.username}</div>
                {isAuthor && <Link to="/admin/dashboard" onClick={() => setDropdownOpen(false)}>Dashboard</Link>}
                {isAuthor && <Link to="/admin/edit-article" onClick={() => setDropdownOpen(false)}>New Article</Link>}
                {isAuthor && <Link to="/admin/edit-course" onClick={() => setDropdownOpen(false)}>New Course</Link>}
                <button className="logout-btn" onClick={() => { logout(); setDropdownOpen(false); }}>Log out</button>
              </div>
            </div>
          )}

          {!user && (
            <div className="nav-join">
              <Link to="/login">Join the Community</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

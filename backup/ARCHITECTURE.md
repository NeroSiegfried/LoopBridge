# LoopBridge — Component-Based Architecture

## Overview

This document describes the component-based restructuring of LoopBridge. The goal is to:

1. **Self-contained components** — each UI component (navbar, footer, article card, course card, etc.) lives in its own HTML/CSS/JS files
2. **Mock backend** — all dynamic data (articles, courses, FAQs, team members, etc.) lives in JSON files and is fetched at runtime
3. **Static-hosting compatible** — works on GitHub Pages (no server required)
4. **No changes to existing pages** — new pages are added alongside the originals for testing
5. **Admin pages** — CRUD for articles/courses, owner/admin gating

---

## Directory Structure

```
LoopBridge/
├── components/                  # Reusable HTML components
│   ├── navbar/
│   │   ├── navbar.html
│   │   ├── navbar.css
│   │   └── navbar.js
│   ├── footer/
│   │   ├── footer.html
│   │   ├── footer.css
│   │   └── footer.js
│   ├── newsletter/
│   │   ├── newsletter.html
│   │   └── newsletter.css
│   ├── article-card/
│   │   ├── article-card.html      # Template for one card
│   │   └── article-card.css
│   ├── course-card/
│   │   ├── course-card.html
│   │   └── course-card.css
│   ├── category-filter/
│   │   ├── category-filter.html
│   │   └── category-filter.css
│   ├── accordion/
│   │   ├── accordion.css
│   │   └── accordion.js
│   └── dropdown/
│       ├── dropdown.html
│       └── dropdown.css
│
├── data/                          # Mock backend (JSON)
│   ├── articles.json
│   ├── courses.json
│   ├── faqs.json
│   ├── team.json
│   ├── platforms.json
│   ├── site.json                  # Global config: nav links, footer, socials
│   └── users.json                 # Mock user/admin auth
│
├── lib/                           # Shared JS utilities
│   ├── component-loader.js        # Fetches & injects HTML components
│   ├── data-service.js            # Fetches JSON data, provides CRUD API
│   ├── auth.js                    # Mock auth (owner/admin detection)
│   ├── router.js                  # Simple hash-based navigation (optional)
│   └── utils.js                   # Shared helpers
│
├── admin/                         # Admin/owner pages
│   ├── admin.html                 # Dashboard
│   ├── admin.css
│   ├── admin.js
│   ├── edit-article.html          # Create/edit article
│   ├── edit-article.css
│   ├── edit-article.js
│   ├── edit-course.html           # Create/edit course
│   ├── edit-course.css
│   └── edit-course.js
│
├── pages/                         # New component-based test pages
│   ├── index.html
│   ├── blog.html
│   ├── articles.html
│   ├── courses.html
│   └── article.html               # Single article (dynamic by ?id=)
│
├── styles/
│   ├── global.css                 # Extracted global styles (variables, resets, typography, hover states)
│   └── ... (existing page CSS)
│
└── ... (existing files untouched)
```

---

## Component Loader

Each new page uses `component-loader.js` to inject shared components:

```html
<div data-component="navbar"></div>
<main> ... page content ... </main>
<div data-component="footer"></div>

<script src="./lib/component-loader.js"></script>
```

The loader:
1. Finds all `[data-component]` elements
2. Fetches `components/{name}/{name}.html`
3. Injects the HTML, then loads associated CSS and JS files
4. Fires a `components-loaded` custom event when all done

---

## Data Service

`data-service.js` provides a simple API:

```js
DataService.getArticles()           // → Promise<Article[]>
DataService.getArticle(id)          // → Promise<Article>
DataService.createArticle(data)     // → stores in localStorage
DataService.updateArticle(id, data) // → updates localStorage
DataService.deleteArticle(id)       // → removes from localStorage

// Same pattern for courses, FAQs, etc.
```

On first load, data is fetched from `/data/*.json`. CRUD operations write to `localStorage` so changes persist across page loads without a real server.

---

## Auth (Mock)

`auth.js` provides:

```js
Auth.login(email, password)  // → checks against users.json
Auth.logout()
Auth.getCurrentUser()        // → { id, name, email, role }
Auth.isAdmin()               // → boolean
Auth.isOwner(resourceId)     // → boolean (checks authorId match)
```

Roles: `admin`, `author`, `user`. Stored in `localStorage`.

---

## Hover/Active States (global.css)

All interactive elements get consistent hover/active/focus states:

- **Buttons** (`.btn-primary`, `.btn-secondary`, `.btn-outline`): hover brightness, active scale, focus ring
- **Nav links**: underline or color shift on hover
- **Card components**: subtle shadow on hover
- **Footer links**: color shift on hover
- **Social icons**: scale up on hover
- **Focus-visible**: visible outline for keyboard navigation

---

## Existing Pages — NOT Modified

The following files remain untouched:
- All `.html` files in the root
- All files in `styles/`, `scripts/`, `fonts/`, `images/`, `backup/`

New component-based pages live in `pages/` and `admin/`.

# LoopBridge — Architecture Guide

## Overview

LoopBridge is a static HTML/CSS/JS website for a crypto-education platform. It uses **no build tools or frameworks** — just vanilla HTML, CSS, and JavaScript with a lightweight component injection system, mock data layer, and mock authentication.

---

## Directory Structure

```
LoopBridge/
├── index.html              ← Home page (root)
├── about.html              ← About Us
├── academy.html            ← Academy hub
├── articles.html           ← Articles listing
├── blog.html               ← Blog hub
├── community.html          ← Community page
├── courses.html            ← Courses listing
├── course_overview.html    ← Single course overview
├── exchange.html           ← Exchange comparison
├── faqs.html               ← FAQ page
├── beginner.html           ← Beginner learning track
├── intermediate.html       ← Intermediate learning track
├── mock_article.html       ← Static article template
├── privacy.html            ← Privacy policy
├── terms.html              ← Terms of service
├── disclaimer.html         ← Disclaimer
│
├── pages/                  ← Dynamic sub-pages (use ../ paths)
│   ├── login.html          ← User login (mock auth)
│   ├── article.html        ← Dynamic article view (?id=art-001)
│   ├── articles.html       ← Dynamic articles listing
│   ├── course.html         ← Dynamic course view (?id=crs-001)
│   └── courses.html        ← Dynamic courses listing
│
├── admin/                  ← Admin panel (use ../ paths)
│   ├── login.html          ← Admin login
│   ├── dashboard.html      ← CRUD dashboard (articles & courses)
│   ├── edit-article.html   ← Create/edit article
│   └── edit-course.html    ← Create/edit course
│
├── components/             ← Reusable HTML/CSS/JS components
│   ├── navbar/             ← Site navigation bar
│   ├── footer/             ← Site footer
│   ├── newsletter/         ← Newsletter signup section
│   ├── article-card/       ← Article card template
│   └── course-card/        ← Course card template
│
├── lib/                    ← Core JavaScript libraries
│   ├── component-loader.js ← Component injection system
│   ├── data-service.js     ← Mock data layer (JSON + localStorage)
│   ├── auth.js             ← Mock authentication system
│   └── utils.js            ← Shared utility functions
│
├── data/                   ← JSON data files
│   ├── articles.json       ← Blog articles
│   ├── courses.json        ← Courses & tracks
│   ├── faqs.json           ← FAQ entries
│   ├── platforms.json      ← Exchange platform data
│   ├── site.json           ← Site metadata
│   ├── team.json           ← Team member profiles
│   └── users.json          ← Mock user accounts
│
├── scripts/                ← Page-specific JavaScript
│   ├── index.js            ← Home page logic
│   ├── blog.js             ← Blog page logic
│   ├── exchange.js         ← Exchange page logic
│   ├── faqs.js             ← FAQ page logic
│   ├── course_overview.js  ← Course overview logic
│   └── learning_track.js   ← Learning track pages logic
│
├── styles/                 ← CSS stylesheets
│   ├── global.css          ← CSS variables, resets, utility classes
│   ├── index.css           ← Base styles (navbar, hero, footer, etc.)
│   ├── academy.css         ← Academy page
│   ├── about.css           ← About page
│   ├── articles.css        ← Articles page
│   ├── blog.css            ← Blog page
│   ├── community.css       ← Community page
│   ├── courses.css         ← Courses page
│   ├── course_overview.css ← Course overview page
│   ├── exchange.css        ← Exchange page
│   ├── faqs.css            ← FAQ page
│   ├── learning_track.css  ← Learning track pages
│   └── legal.css           ← Privacy/terms/disclaimer pages
│
├── images/logos/           ← Logo assets
├── fonts/                  ← CabinetGrotesk local font files
├── ARCHITECTURE.md         ← This file
└── TODO.md                 ← Build checklist
```

---

## Component System

### How It Works

The component system is driven by `lib/component-loader.js`. Any HTML element with a `data-component` attribute is treated as a component slot.

```html
<div data-component="navbar" data-props='{"basePath":"./","activePage":"blog"}'></div>
```

On page load, `component-loader.js`:

1. Finds all `[data-component]` elements
2. For each element, fetches:
   - `components/{name}/{name}.html` — HTML template
   - `components/{name}/{name}.css` — Styles (injected into `<head>`)
   - `components/{name}/{name}.js` — Behavior (injected into `<body>`)
3. Interpolates `{{key}}` placeholders in the HTML with values from `data-props`
4. Injects the interpolated HTML into the host element
5. Fires a `components-loaded` CustomEvent on `document` when all components are ready

### Base Path Resolution

The loader auto-detects the page location:
- **Root pages** (`/index.html`, `/about.html`, etc.) → basePath = `./`
- **Sub-pages** (`/pages/*.html`, `/admin/*.html`) → basePath = `../`

### Components

| Component | Files | Purpose |
|-----------|-------|---------|
| `navbar` | navbar.html/css/js | Site navigation with mobile menu, auth user slot |
| `footer` | footer.html/css/js | Site footer with links and copyright |
| `newsletter` | newsletter.html/css | Email signup section |
| `article-card` | article-card.html/css/js | Reusable article card |
| `course-card` | course-card.html/css/js | Reusable course card |

### Navbar Auth UI

The navbar includes a user authentication slot (`#nav-user-slot`). When a user is logged in:
- Shows an avatar circle with initials + display name
- Click reveals a dropdown with "Admin Dashboard" (admin only) and "Logout"
- The "Join Us" button is hidden when logged in

This is powered by `navbar.js` which reads `Auth.getCurrentUser()` and listens for `auth-changed` events.

---

## CSS Architecture

### Layer Order

Every page loads CSS in a specific order — this order matters:

1. **`styles/index.css`** — Base styles including reset, navbar, hero section, footer, newsletter, responsive breakpoints. Loaded by every page.
2. **Page-specific CSS** — e.g., `styles/academy.css`, `styles/blog.css`. Some pages load multiple (e.g., `about.html` loads `academy.css` + `about.css`).
3. **`styles/global.css`** — CSS custom properties (variables), enhanced hover/active/focus states, utility classes, toast/modal styles. Loaded last so it can augment without overriding.
4. **Component CSS** — Loaded dynamically by the component loader.

### Key CSS Variables (defined in `global.css`)

```css
--font-heading: "CabinetGrotesk-Bold"
--font-heading-variable: "CabinetGrotesk-Variable"
--font-body: "Schibsted Grotesk"
--lb-green: #30C070
--lb-blue-dark: #1a1a2e
--lb-blue-text: #16163a
--gray-light: #f8f9fa
--gray-mid: #e2e2e2
--black-mid: #555
--black-dark: #1a1a1a
--max-width: 1200px
--radius-card: 1.25rem
```

### Font Stack

- **Headings**: CabinetGrotesk (self-hosted in `/fonts/`, loaded via `@font-face` in `global.css`)
- **Body**: Schibsted Grotesk (Google Fonts)
- **Code/Mono**: Roboto (Google Fonts, used sparingly)
- **Icons**: Font Awesome 6 (kit `20310b9de2`), Line Icons 5.1, Material Symbols Outlined

---

## Data Layer

### `lib/data-service.js`

The DataService provides a mock CRUD backend:

1. **First read**: Fetches from `data/{collection}.json` via `fetch()`
2. **Writes**: Saves to `localStorage` with `lb_` prefix keys
3. **Subsequent reads**: Returns localStorage data if present, otherwise re-fetches JSON

#### API

```javascript
// Articles
await DataService.getArticles()
await DataService.getArticle(id)
await DataService.getArticlesByCategory(category)
await DataService.getFeaturedArticles()
await DataService.createArticle(data)
await DataService.updateArticle(id, updates)
await DataService.deleteArticle(id)

// Courses
await DataService.getCourses()
await DataService.getCourse(id)
await DataService.getCoursesByTrack(track)
await DataService.createCourse(data)
await DataService.updateCourse(id, updates)
await DataService.deleteCourse(id)

// Utility
DataService.resetAll()  // Clears all localStorage overrides
```

### JSON Data Files

| File | Content |
|------|---------|
| `articles.json` | Blog articles with id, title, category, author, excerpt, content blocks |
| `courses.json` | Courses with id, title, track, duration, objectives, topics/subsections |
| `faqs.json` | FAQ entries grouped by category |
| `platforms.json` | Crypto exchange platform comparison data |
| `site.json` | Site-wide metadata (name, tagline, social links) |
| `team.json` | Team member profiles |
| `users.json` | Mock user accounts (username, password, role, authorOf) |

---

## Authentication

### `lib/auth.js`

Mock authentication using localStorage session storage.

#### Flow

1. User visits `/pages/login.html` or `/admin/login.html`
2. Submits username + password
3. `Auth.login(username, password)` fetches `data/users.json`, finds matching user
4. On success: stores session in `localStorage` key `lb_session` (JSON, no password)
5. On failure: returns `null`

#### API

```javascript
await Auth.login(username, password)  // → user object or null
Auth.logout()
Auth.getCurrentUser()    // → user object or null
Auth.isLoggedIn()        // → boolean
Auth.isAdmin()           // → boolean
Auth.isAuthor()          // → boolean (includes admins)
Auth.canEdit(itemId)     // → boolean (admin or owner)
Auth.canDelete(itemId)   // → boolean (same as canEdit)
Auth.requireAuth()       // → user or redirect to login
Auth.requireAdmin()      // → admin user or redirect
Auth.renderAuthUI(el)    // → populates element with login/user UI
```

#### Demo Accounts

| Username | Password | Role | Notes |
|----------|----------|------|-------|
| `admin` | `admin123` | admin | Full access to all CRUD |
| `ngozi` | `author123` | author | Can edit own articles |
| `chioma` | `author123` | author | Can edit own articles |
| `demo` | `demo123` | user | Read-only access |

---

## Utilities

### `lib/utils.js`

Shared helper functions exposed as `window.Utils`:

```javascript
Utils.formatDate(isoString)       // Formatted date string
Utils.timeAgo(isoString)          // "2 hours ago" style
Utils.slugify(text)               // URL-safe slug
Utils.truncate(text, maxLen)      // Truncated with "..."
Utils.readingTime(content)        // "5 min read"
Utils.getParam(name)              // URL query parameter
Utils.setParam(name, value)       // Update URL query parameter
Utils.debounce(fn, delay)         // Debounced function
Utils.escapeHTML(str)             // XSS-safe HTML escaping
Utils.showToast(msg, type, dur)   // Toast notification
Utils.confirm(msg, title)         // Confirm dialog (returns Promise<boolean>)
Utils.showSkeletons(el, count)    // Loading skeleton placeholders
```

---

## Page Wiring

### Typical Root Page Pattern

```html
<head>
    <link rel="stylesheet" href="./styles/index.css">
    <link rel="stylesheet" href="./styles/{page}.css">
    <link rel="stylesheet" href="./styles/global.css">
    <!-- Google Fonts, Font Awesome, Line Icons -->
</head>
<body>
    <!-- Component: Navbar -->
    <div data-component="navbar" data-props='{"basePath":"./","activePage":"..."}'></div>

    <!-- Page Content (exact original HTML) -->
    <section class="...">...</section>

    <!-- Component: Newsletter (if page had one) -->
    <div data-component="newsletter" data-props='{"basePath":"./"}'></div>

    <!-- Component: Footer -->
    <div data-component="footer" data-props='{"basePath":"./"}'></div>

    <!-- Libraries -->
    <script src="./lib/auth.js"></script>
    <script src="./lib/component-loader.js"></script>

    <!-- Page Script (if any) -->
    <script src="./scripts/{page}.js"></script>
</body>
```

### Sub-Page Pattern (pages/, admin/)

Same structure but with `../` base paths:
```html
<link rel="stylesheet" href="../styles/global.css">
<div data-component="navbar" data-props='{"basePath":"../"}'></div>
<script src="../lib/auth.js"></script>
<script src="../lib/component-loader.js"></script>
```

---

## Admin Panel

### Access

1. Navigate to `/admin/login.html` or click "Admin Dashboard" from navbar dropdown
2. Log in with admin credentials (`admin` / `admin123`)
3. Dashboard shows article/course counts and CRUD tables

### Features

- **Dashboard**: View all articles and courses in tabbed tables
- **Create/Edit Article**: Title, category, author, excerpt, featured flag, content blocks (heading/paragraph/list/blockquote)
- **Create/Edit Course**: Title, track, duration, instructor, description, learning objectives, topics with subsections
- **Delete**: Confirm dialog before deletion
- **Reset Data**: Clears all localStorage overrides, restores original JSON data

### Permission Model

| Action | Admin | Author | User |
|--------|-------|--------|------|
| View articles/courses | ✅ | ✅ | ✅ |
| Create articles | ✅ | ✅ | ❌ |
| Edit own articles | ✅ | ✅ | ❌ |
| Edit all articles | ✅ | ❌ | ❌ |
| Create/edit courses | ✅ | ❌ | ❌ |
| Delete anything | ✅ | Own only | ❌ |
| Access admin panel | ✅ | ✅ | ❌ |

---

## Events

| Event | Target | When |
|-------|--------|------|
| `components-loaded` | `document` | All data-component elements have been loaded and injected |
| `auth-changed` | `window` | User logs in or out (navbar listens for this to re-render) |

---

## Development

### Running Locally

No build step required. Serve with any static file server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .

# VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

### Adding a New Page

1. Create `newpage.html` in root (or `pages/newpage.html` for sub-pages)
2. Follow the page wiring pattern above
3. Create `styles/newpage.css` if needed
4. Create `scripts/newpage.js` if needed
5. Add navigation link in `components/navbar/navbar.html`

### Adding a New Component

1. Create `components/mycomp/mycomp.html` (template with `{{prop}}` placeholders)
2. Create `components/mycomp/mycomp.css` (scoped styles)
3. Create `components/mycomp/mycomp.js` (optional behavior)
4. Use: `<div data-component="mycomp" data-props='{"prop":"value"}'></div>`

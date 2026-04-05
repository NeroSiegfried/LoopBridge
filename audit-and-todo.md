# Architectural Audit and Refactor To-Do

## 1. Architectural Overview

### Original Architecture (Backup)
The original `backup/` implementation represents a purely static, standard HTML flow. Each page manages its own navigation markup and UI footprint manually, ensuring maximum control over document structure and CSS cascading.
- **Data Flow:** Hard-coded into the HTML mockups. No JS injection required.
- **Component Flow:** UI components (Navbar, Footer, article headers, cards) are written directly into each HTML file.
- **Structure (Example `mock_article.html`):** 
  - `<nav>` directly in the body.
  - `<section class="article-section">` containing `.header` -> `.article-title`, `.article-image`, `.article-meta`.
  - The styling assumes this exact nested hierarchy for flex/grid and spacing rules.

### Current Architecture (Root)
The new implementation shifts to a hybrid dynamic system relying on JS `lib/component-loader.js` and `lib/data-service.js`.
- **Data Flow:** JSON data and state models are populated statically from `data/` and updated through `localStorage`. Data bindings inject content at runtime.
- **Component Flow:** Custom `data-component` tags load HTML, CSS, and JS fragments externally (e.g., `<div data-component="navbar"></div>`). 
- **Structure (Example `pages/article.html`):** 
  - Dynamic components load asynchronously, sometimes restructuring the final DOM (altering parent wrappers).
  - DOM injection replaces raw elements. 
  - E.g., The article header uses an explicit `header.article-page-hero` structure that splits elements. Dynamic generation scripts were also injecting unwanted category pills and misordering the Title, Image, and Meta sections compared to the static `.article-section > .header` layout.

## 2. Document Flow Differences

### Article Page Flow Deviation
**Original (`backup/mock_article.html`) Document Flow:**
```html
<section class="article-section">
    <div class="header">
        <h1 class="article-title">...</h1>
        <div class="article-image">...</div>
        <div class="article-meta">...</div>
    </div>
    <!-- Body text follows underneath -->
    <div class="body">...</div>
</section>
```

**New (`pages/article.html`) Document Flow:**
The JS-injected DOM changed the visual structure to:
- Title
- Meta (incorrectly placed before image)
- Image
- Unauthorized / Unwanted "Category Pill" injected dynamically.

This breaks the CSS `.header` cascade and the aesthetic of the original design. Similar deviations likely exist in the Admin tools where blue/yellow elements were improperly carried over instead of neutral UI palettes.

## 3. Implementation Status Checklist

- `index.html`: Structurally different. Moved to component architecture.
- `about.html`: Component architecture.
- `academy.html`: Component architecture.
- `articles.html` / `blog.html`: Logic shifted to `scripts/blog.js`.
- `pages/article.html`: Deviaitng from `backup/mock_article.html`. (JS DOM needs correction).
- `course_overview.html`: Converted to JS-driven dynamic layout.
- Component Files (`components/navbar/`, `components/footer/`): Extracted successfully but caused mobile stacking CSS bugs (partially addressed).
- Admin Pages (`admin/edit-article.html`, `admin/edit-course.html`): Styles converted to JS generation, color palettes disrupted.

## 4. Remediation To-Do List

- [ ] **Audit dynamic DOM scripts:** Review all `scripts/` (specifically `scripts/blog.js` or related article generation scripts) to freeze structural overreach (remove unwanted category pills, ensure exact element ordering matches `backup/mock_article.html`).
- [ ] **Fix Article Header Flow:** Align `pages/article.html` `header.article-page-hero` structure to perfectly match the `Title -> Image -> Meta` order of the original mock.
- [ ] **Synchronize CSS Selectors:** Review `styles/global.css` and `pages/styles/article.css` against `backup/styles/articles.css` to ensure dynamic class names map perfectly (e.g. `article-page-hero` vs `.header`).
- [ ] **Component CSS Isolation Check:** Validate that `<div data-component="navbar">` isolation doesn't break global flex rules (e.g., the `.nav-user` column stacking issue).
- [ ] **Audit Color Palettes:** Complete the sweep of removing blue/yellow default colors in dynamically injected buttons/links across the `.admin/` dashboard and course editors.
- [ ] **Final QA Comparison:** Once structural flow is matching, run a side-by-side visual comparison in the browser of the pure HTML backup vs the dynamic root structure.
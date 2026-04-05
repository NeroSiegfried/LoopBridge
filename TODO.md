# LoopBridge — TODO List

## Quick Fixes
- [x] 1. Increase `.mobile-auth-avatar` from 32px (2rem) → 40px (2.5rem) in `navbar.css`
- [x] 2. Move menu-toggle click listener to `.nav-right-controls` (avatar should NOT animate, only the hamburger icon)
- [x] 3. Hardcode author fields in `admin/edit-article.html` and `admin/edit-course.html` — read-only from `Auth.getCurrentUser()`

## CSS/JS Extraction (Internal → External)
- [x] 4. `admin/edit-article.html` → extract `<style>` to `admin/styles/edit-article.css`
- [x] 5. `admin/edit-article.html` → extract `<script>` to `admin/scripts/edit-article.js`
- [x] 6. `admin/edit-course.html` → extract `<style>` to `admin/styles/edit-course.css`
- [x] 7. `admin/edit-course.html` → extract `<script>` to `admin/scripts/edit-course.js`
- [x] 8. `admin/dashboard.html` → extract `<style>` to `admin/styles/dashboard.css`
- [x] 9. `admin/dashboard.html` → extract `<script>` to `admin/scripts/dashboard.js`
- [x] 10. `admin/login.html` → extract `<style>` to `admin/styles/login.css`
- [x] 11. `admin/login.html` → extract `<script>` to `admin/scripts/login.js`
- [x] 12. `pages/login.html` → extract `<style>` to `pages/styles/login.css`
- [x] 13. `pages/login.html` → extract `<script>` to `pages/scripts/login.js`
- [x] 14. `pages/article.html` → extract `<script>` to `pages/scripts/article.js`
- [x] 15. `pages/articles.html` → extract `<style>` to `pages/styles/articles.css`
- [x] 16. `pages/articles.html` → extract `<script>` to `pages/scripts/articles.js`
- [x] 17. `pages/course.html` → extract `<style>` to `pages/styles/course.css`
- [x] 18. `pages/course.html` → extract `<script>` to `pages/scripts/course.js`
- [x] 19. `pages/courses.html` → extract `<style>` to `pages/styles/courses.css`
- [x] 20. `pages/courses.html` → extract `<script>` to `pages/scripts/courses.js`
- [x] 21. Root `beginner.html` → extract `<script>` to `scripts/beginner.js`
- [x] 22. Root `intermediate.html` → extract `<script>` to `scripts/intermediate.js`
- [x] 23. Root `advanced.html` → extract `<script>` to `scripts/advanced.js`
- [x] 24. Root `blog.html` → extract `<script>` to `scripts/blog-page.js` (blog.js already exists for shared logic)
- [x] 25. Root `articles.html` → extract `<script>` to `scripts/articles-page.js`
- [x] 26. Root `course_overview.html` → extract `<script>` to `scripts/course_overview-page.js`
- [x] 27. Root `faqs.html` → extract `<script>` to `scripts/faqs-page.js`

## Backend Implementation
- [x] 28. Initialize Node.js/Express backend project (`server/`)
- [x] 29. Set up SQLite database with tables: users, articles, courses, sessions, faqs, progress
- [x] 30. Create API routes: auth (login/logout/session), articles CRUD, courses CRUD, FAQs, site/team/platforms
- [x] 31. Migrate `lib/data-service.js` to use API calls instead of JSON + localStorage
- [x] 32. Migrate `lib/auth.js` to use API-based auth with session tokens

document.addEventListener('components-loaded', async () => {
    // ─── Auth check — only admin/author can see dashboard ──
    const user = Auth.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    if (user.role !== 'admin' && user.role !== 'author') {
        alert('Access denied. Author or admin privileges required.');
        window.location.href = '../index.html';
        return;
    }

    const isAdminUser = user.role === 'admin';

    // Populate header
    document.getElementById('welcome-title').textContent = 'Welcome, ' + user.displayName;

    // Reset data (admin only)
    const resetBtn = document.getElementById('reset-data-btn');
    if (!isAdminUser && resetBtn) {
        resetBtn.style.display = 'none';
    } else if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const confirmed = await Utils.confirm(
                'This will reset all articles and courses to their original state. Any changes you made will be lost.',
                'Reset All Data'
            );
            if (confirmed) {
                DataService.resetAll();
                Utils.showToast('Data reset successfully.', 'success');
                setTimeout(() => window.location.reload(), 1000);
            }
        });
    }

    // ─── Load role-filtered data from the server ────────────
    let articles, courses;
    try {
        const dashboard = await DataService.getDashboard();
        articles = dashboard.articles || [];
        courses = dashboard.courses || [];
    } catch (err) {
        Utils.showToast('Failed to load dashboard data.', 'error');
        articles = [];
        courses = [];
    }

    const activeArticles = articles.filter(a => !a.deleted);
    const activeCourses = courses.filter(c => !c.deleted);

    // Stats
    document.getElementById('stats-strip').innerHTML =
        '<div class="stat-card">' +
            '<div class="stat-number">' + activeArticles.length + '</div>' +
            '<div class="stat-label">Articles</div>' +
        '</div>' +
        '<div class="stat-card">' +
            '<div class="stat-number">' + activeCourses.length + '</div>' +
            '<div class="stat-label">Courses</div>' +
        '</div>' +
        '<div class="stat-card">' +
            '<div class="stat-number">' + new Set(activeArticles.map(a => a.category)).size + '</div>' +
            '<div class="stat-label">Categories</div>' +
        '</div>' +
        '<div class="stat-card">' +
            '<div class="stat-number">' + new Set(activeCourses.map(c => c.track)).size + '</div>' +
            '<div class="stat-label">Learning Tracks</div>' +
        '</div>' +
        (isAdminUser && articles.some(a => a.deleted) ?
        '<div class="stat-card">' +
            '<div class="stat-number" style="color:#991b1b">' + (articles.filter(a => a.deleted).length + courses.filter(c => c.deleted).length) + '</div>' +
            '<div class="stat-label">Deleted</div>' +
        '</div>' : '');

    // Tabs
    var tabs = document.querySelectorAll('.dashboard-tab');
    var articlesPanel = document.getElementById('articles-panel');
    var coursesPanel = document.getElementById('courses-panel');

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            tabs.forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');

            if (tab.dataset.tab === 'articles') {
                articlesPanel.style.display = '';
                coursesPanel.style.display = 'none';
            } else {
                articlesPanel.style.display = 'none';
                coursesPanel.style.display = '';
            }
        });
    });

    // Render tables
    renderArticlesTable(articles);
    renderCoursesTable(courses);

    function authorName(a) {
        if (!a.author) return '\u2014';
        if (typeof a.author === 'string') return a.author;
        return a.author.name || '\u2014';
    }

    function renderArticlesTable(items) {
        var tbody = document.getElementById('articles-tbody');

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="dashboard-empty">No articles to display.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(function(article) {
            var canEdit = isAdminUser || Auth.canEdit(article.id) || (user.displayName && user.displayName === authorName(article));
            var isDeleted = !!article.deleted;
            return '<tr>' +
                '<td class="title-cell ' + (isDeleted ? 'deleted-item' : '') + '">' + Utils.escapeHTML(article.title) + (isDeleted ? '<span class="badge-deleted">Deleted</span>' : '') + '</td>' +
                '<td class="meta-cell">' + (article.category || '\u2014') + '</td>' +
                '<td class="meta-cell">' + authorName(article) + '</td>' +
                '<td><div class="actions-cell">' +
                    (!isDeleted ? '<a href="../pages/article.html?id=' + article.id + '" class="btn btn-sm btn-ghost" title="View"><i class="fa-solid fa-eye"></i></a>' : '') +
                    (canEdit && !isDeleted ? '<a href="edit-article.html?id=' + article.id + '" class="btn btn-sm btn-ghost" title="Edit"><i class="fa-solid fa-pen"></i></a>' : '') +
                    (canEdit && !isDeleted ? '<button class="btn btn-sm btn-danger delete-article-btn" data-id="' + article.id + '" title="Delete"><i class="fa-solid fa-trash"></i></button>' : '') +
                    (isDeleted && isAdminUser ? '<button class="btn btn-sm btn-secondary restore-article-btn" data-id="' + article.id + '" title="Restore"><i class="fa-solid fa-rotate-left"></i></button>' : '') +
                '</div></td></tr>';
        }).join('');

        tbody.querySelectorAll('.delete-article-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var confirmed = await Utils.confirm('Delete this article? It will be hidden from public view but can be restored later.', 'Delete Article');
                if (confirmed) {
                    try {
                        await DataService.deleteArticle(btn.dataset.id);
                        Utils.showToast('Article deleted.', 'success');
                        var updated = await DataService.getDashboard();
                        renderArticlesTable(updated.articles || []);
                    } catch (err) {
                        Utils.showToast('Failed to delete.', 'error');
                    }
                }
            });
        });

        tbody.querySelectorAll('.restore-article-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                try {
                    await DataService.restoreArticle(btn.dataset.id);
                    Utils.showToast('Article restored.', 'success');
                    var updated = await DataService.getDashboard();
                    renderArticlesTable(updated.articles || []);
                } catch (err) {
                    Utils.showToast('Failed to restore.', 'error');
                }
            });
        });
    }

    function renderCoursesTable(items) {
        var tbody = document.getElementById('courses-tbody');

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="dashboard-empty">No courses to display.</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(function(course) {
            var canEdit = isAdminUser || Auth.canEdit(course.id);
            var isDeleted = !!course.deleted;
            var isPending = course.approved === false;
            return '<tr>' +
                '<td class="title-cell ' + (isDeleted ? 'deleted-item' : '') + '">' + Utils.escapeHTML(course.title) + (isDeleted ? '<span class="badge-deleted">Deleted</span>' : '') + (isPending ? '<span class="badge-pending">Pending</span>' : '') + '</td>' +
                '<td class="meta-cell">' + (course.track || '\u2014') + '</td>' +
                '<td class="meta-cell">' + (course.duration || '\u2014') + '</td>' +
                '<td><div class="actions-cell">' +
                    (!isDeleted ? '<a href="../course_overview.html?id=' + course.id + '" class="btn btn-sm btn-ghost" title="View"><i class="fa-solid fa-eye"></i></a>' : '') +
                    (canEdit && !isDeleted ? '<a href="edit-course.html?id=' + course.id + '" class="btn btn-sm btn-ghost" title="Edit"><i class="fa-solid fa-pen"></i></a>' : '') +
                    (isPending && isAdminUser && !isDeleted ? '<button class="btn btn-sm btn-secondary approve-course-btn" data-id="' + course.id + '" title="Approve"><i class="fa-solid fa-check"></i></button>' : '') +
                    (canEdit && !isDeleted ? '<button class="btn btn-sm btn-danger delete-course-btn" data-id="' + course.id + '" title="Delete"><i class="fa-solid fa-trash"></i></button>' : '') +
                    (isDeleted && isAdminUser ? '<button class="btn btn-sm btn-secondary restore-course-btn" data-id="' + course.id + '" title="Restore"><i class="fa-solid fa-rotate-left"></i></button>' : '') +
                '</div></td></tr>';
        }).join('');

        tbody.querySelectorAll('.delete-course-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var confirmed = await Utils.confirm('Delete this course? It will be hidden from public view but can be restored later.', 'Delete Course');
                if (confirmed) {
                    try {
                        await DataService.deleteCourse(btn.dataset.id);
                        Utils.showToast('Course deleted.', 'success');
                        var updated = await DataService.getDashboard();
                        renderCoursesTable(updated.courses || []);
                    } catch (err) {
                        Utils.showToast('Failed to delete.', 'error');
                    }
                }
            });
        });

        tbody.querySelectorAll('.restore-course-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                try {
                    await DataService.restoreCourse(btn.dataset.id);
                    Utils.showToast('Course restored.', 'success');
                    var updated = await DataService.getDashboard();
                    renderCoursesTable(updated.courses || []);
                } catch (err) {
                    Utils.showToast('Failed to restore.', 'error');
                }
            });
        });

        tbody.querySelectorAll('.approve-course-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                try {
                    await DataService.updateCourse(btn.dataset.id, { approved: true });
                    Utils.showToast('Course approved and now publicly visible.', 'success');
                    var updated = await DataService.getDashboard();
                    renderCoursesTable(updated.courses || []);
                } catch (err) {
                    Utils.showToast('Failed to approve.', 'error');
                }
            });
        });
    }
});

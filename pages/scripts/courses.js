document.addEventListener('components-loaded', async () => {
    const grid = document.getElementById('courses-grid');
    const tabsContainer = document.getElementById('track-tabs');

    let allCourses = [];
    let currentTrack = 'All';

    Utils.showSkeletons(grid, 6, 'card');

    allCourses = await DataService.getCourses();

    // Extract unique tracks
    const tracks = ['All', ...new Set(allCourses.map(c => c.track).filter(Boolean))];

    // Render track tabs
    tabsContainer.innerHTML = tracks.map(track => `
        <button class="category-pill${track === 'All' ? ' active' : ''}" data-track="${track}">
            ${track.charAt(0).toUpperCase() + track.slice(1)}
        </button>
    `).join('');

    tabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-pill');
        if (!btn) return;

        currentTrack = btn.dataset.track;
        tabsContainer.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderCourses();
    });

    function renderCourses() {
        const filtered = currentTrack === 'All'
            ? allCourses
            : allCourses.filter(c => c.track === currentTrack);

        const showAdmin = Auth.isLoggedIn() && Auth.isAdmin();

        CourseCard.renderGrid(grid, filtered, {
            basePath: '../',
            showAdmin: showAdmin
        });

        // Admin handlers
        if (showAdmin) {
            grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = '../admin/edit-course.html?id=' + btn.dataset.id;
                });
            });

            grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const confirmed = await Utils.confirm('Delete this course?', 'Delete Course');
                    if (confirmed) {
                        try {
                            await DataService.deleteCourse(btn.dataset.id);
                            allCourses = allCourses.filter(c => c.id !== btn.dataset.id);
                            Utils.showToast('Course deleted.', 'success');
                            renderCourses();
                        } catch (err) {
                            Utils.showToast('Failed to delete.', 'error');
                        }
                    }
                });
            });
        }
    }

    renderCourses();
});

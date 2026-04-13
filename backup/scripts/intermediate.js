document.addEventListener('components-loaded', async () => {
    const allCourses = await DataService.getCourses();
    const courses = allCourses.filter(c => c.track === 'intermediate');
    const grid = document.getElementById('courses-grid');
    const countEl = document.querySelector('.count');

    const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
    const userId = user ? user.id : null;

    if (countEl) countEl.textContent = courses.length + ' course' + (courses.length !== 1 ? 's' : '');

    async function getProgressHTML(course) {
        if (!userId) return '';
        try {
            const prog = await DataService.getCourseProgress(userId, course.id);
            if (!prog || !prog.completedSubs) return '';
            let totalSubs = 0;
            (course.topics || []).forEach(t => { totalSubs += (t.subsections || []).length; });
            if (totalSubs === 0) return '';
            const pct = Math.round((prog.completedSubs.length / totalSubs) * 100);
            return `<div class="course-progress-bar">
                <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
                <span class="progress-label">${pct}%</span>
            </div>`;
        } catch {
            return '';
        }
    }

    async function renderCourses(list) {
        if (!grid) return;
        const cards = await Promise.all(list.map(async c => {
            const progressHTML = await getProgressHTML(c);
            return `
            <a href="./course_overview.html?id=${c.id}">
                <div class="course-container">
                    <div class="course-card">
                        <div class="course-image">
                            <div class="course-price${c.price ? ' paid' : ''}">${c.price ? '$' + c.price : 'Free'}</div>
                            <img src="${c.image || ''}" alt="${Utils.escapeHTML(c.title)}"/>
                        </div>
                        <div class="course-body">
                            <div class="main-text">
                                <h3 class="course-title">${Utils.escapeHTML(c.title)}</h3>
                                <p class="course-description">${Utils.escapeHTML(c.description || '')}</p>
                            </div>
                            ${progressHTML}
                            <p class="course-author">By ${c.author ? (typeof c.author === 'string' ? c.author : c.author.name || 'LoopBridge Team') : 'LoopBridge Team'}</p>
                        </div>
                    </div>
                </div>
            </a>`;
        }));
        grid.innerHTML = cards.join('');
    }

    await renderCourses(courses);

    // Search
    const searchInput = document.querySelector('.search input');
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(async () => {
            const q = searchInput.value.toLowerCase().trim();
            const filtered = q ? courses.filter(c => c.title.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)) : courses;
            await renderCourses(filtered);
        }, 250));
    }
});

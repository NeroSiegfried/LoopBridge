document.addEventListener('components-loaded', async () => {
    const courseId = Utils.getParam('id');
    if (!courseId) {
        document.getElementById('course-title').textContent = 'Course Not Found';
        return;
    }

    const course = await DataService.getCourse(courseId);
    if (!course) {
        document.getElementById('course-title').textContent = 'Course Not Found';
        return;
    }

    document.title = course.title + ' — LoopBridge';

    // Badge
    const badgeEl = document.getElementById('course-badge');
    badgeEl.textContent = course.track;
    badgeEl.classList.add('badge-' + course.track);

    // Title & description
    document.getElementById('course-title').textContent = course.title;
    document.getElementById('course-description').textContent = course.description || '';

    // Meta
    const metaEl = document.getElementById('course-meta');
    const topicCount = course.topics ? course.topics.length : 0;
    let lessonCount = 0;
    if (course.topics) {
        course.topics.forEach(t => {
            lessonCount += t.subsections ? t.subsections.length : 0;
        });
    }
    metaEl.innerHTML = `
        <div class="meta-item"><i class="fa-solid fa-list"></i> ${topicCount} topics</div>
        <div class="meta-item"><i class="fa-solid fa-file-lines"></i> ${lessonCount} lessons</div>
        <div class="meta-item"><i class="fa-regular fa-clock"></i> ${course.duration || ''}</div>
        <div class="meta-item"><i class="fa-solid fa-user"></i> ${course.author || 'LoopBridge Academy'}</div>
    `;

    // Learning objectives
    const objectivesEl = document.getElementById('course-objectives');
    if (course.learningObjectives && course.learningObjectives.length) {
        objectivesEl.innerHTML = course.learningObjectives.map(obj =>
            `<li><i class="fa-solid fa-check"></i> ${Utils.escapeHTML(obj)}</li>`
        ).join('');
    }

    // Topics accordion
    const topicsContainer = document.getElementById('topics-container');
    if (course.topics && course.topics.length) {
        topicsContainer.innerHTML = course.topics.map((topic, idx) => {
            const subsections = (topic.subsections || []).map(sub =>
                `<div class="subsection">
                    <span class="subsection-title">${Utils.escapeHTML(sub.title)}</span>
                    <span class="subsection-duration">${sub.duration || ''}</span>
                </div>`
            ).join('');

            return `
                <div class="topic${idx === 0 ? ' active' : ''}">
                    <div class="topic-header" role="button" tabindex="0" aria-expanded="${idx === 0 ? 'true' : 'false'}">
                        <h3>${Utils.escapeHTML(topic.title)}</h3>
                        <div class="topic-meta">
                            <span>${topic.subsections ? topic.subsections.length : 0} lessons</span>
                            <i class="fa-solid fa-chevron-down topic-toggle"></i>
                        </div>
                    </div>
                    <div class="topic-body">
                        <div class="topic-body-inner">
                            ${subsections}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Accordion behavior
        topicsContainer.querySelectorAll('.topic-header').forEach(header => {
            header.addEventListener('click', () => toggleTopic(header));
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTopic(header);
                }
            });
        });
    }

    function toggleTopic(header) {
        const topic = header.closest('.topic');
        const wasActive = topic.classList.contains('active');

        // Close all
        topicsContainer.querySelectorAll('.topic').forEach(t => {
            t.classList.remove('active');
            t.querySelector('.topic-header').setAttribute('aria-expanded', 'false');
        });

        // Open clicked if it wasn't active
        if (!wasActive) {
            topic.classList.add('active');
            header.setAttribute('aria-expanded', 'true');
        }
    }
});

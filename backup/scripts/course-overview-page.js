document.addEventListener('components-loaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('id');
    if (!courseId) return;

    const course = await DataService.getCourse(courseId);
    if (!course) return;

    const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
    const userId = user ? user.id : null;

    // Get user's progress for this course
    let courseProgress = userId ? DataService.getCourseProgress(userId, courseId) : null;

    function authorName(c) {
        if (!c.author) return 'LoopBridge Team';
        if (typeof c.author === 'string') return c.author;
        return c.author.name || 'LoopBridge Team';
    }

    // Populate hero
    const titleEl = document.querySelector('.course-title');
    const descEl = document.querySelector('.course-description');
    const authorEl = document.querySelector('.author p');
    const durationEl = document.querySelector('.duration p');
    const difficultyEl = document.querySelector('.difficulty p');

    if (titleEl) titleEl.textContent = course.title;
    if (descEl) descEl.textContent = course.description || '';
    if (authorEl) authorEl.textContent = authorName(course);
    if (durationEl) durationEl.textContent = course.duration || '';
    if (difficultyEl) difficultyEl.textContent = (course.level || 'Beginner') + ' Level';

    // Enroll button
    const enrollBtn = document.querySelector('.course-enroll-btn');
    if (enrollBtn) {
        if (courseProgress) {
            enrollBtn.textContent = 'Continue Course';
        }
        enrollBtn.addEventListener('click', () => {
            if (!userId) {
                if (typeof Utils !== 'undefined') Utils.showToast('Please log in to enroll in courses.', 'info');
                return;
            }
            DataService.enrollInCourse(userId, courseId);
            courseProgress = DataService.getCourseProgress(userId, courseId);
            enrollBtn.textContent = 'Continue Course';
            if (typeof Utils !== 'undefined') Utils.showToast('You are now enrolled in this course!', 'success');
        });
    }

    // Populate overview + learning objectives
    const bodySection = document.querySelector('.course-body .section-container');
    if (bodySection && course.overview) {
        const overviewP = bodySection.querySelector('p');
        if (overviewP) overviewP.textContent = course.overview;
    }

    if (course.learningObjectives && course.learningObjectives.length) {
        const ul = bodySection.querySelector('ul');
        if (ul) {
            ul.innerHTML = course.learningObjectives.map(obj => `<li>${Utils.escapeHTML(obj)}</li>`).join('');
        }
    }

    // Helper: generate a stable subsection ID
    function subId(topicIdx, subIdx) {
        return `t${topicIdx}-s${subIdx}`;
    }

    // Helper: count total subsections in a topic
    function topicSubCount(topic) {
        return topic.subsections ? topic.subsections.length : 0;
    }

    // Helper: count completed subsections for a topic
    function topicCompletedCount(topicIdx, topic) {
        if (!courseProgress) return 0;
        let count = 0;
        (topic.subsections || []).forEach((_, si) => {
            if (courseProgress.completedSubs.includes(subId(topicIdx, si))) count++;
        });
        return count;
    }

    // Populate syllabus dynamically from topics
    if (course.topics && course.topics.length) {
        const topicsContainer = document.querySelector('.topics');
        if (topicsContainer) {
            topicsContainer.innerHTML = course.topics.map((topic, i) => {
                const videos = topic.subsections ? topic.subsections.filter(s => s.type === 'video').length : 0;
                const quizzes = topic.subsections ? topic.subsections.filter(s => s.type === 'quiz').length : 0;
                const total = topicSubCount(topic);
                const completed = topicCompletedCount(i, topic);
                const isTopicComplete = total > 0 && completed === total;

                const subsectionsHTML = (topic.subsections || []).map((sub, si) => {
                    const icon = sub.type === 'quiz' ? 'fa-clipboard-list' : 'fa-circle-play';
                    const label = sub.type === 'quiz' ? 'Quiz' : 'Learn';
                    const sid = subId(i, si);
                    const isComplete = courseProgress && courseProgress.completedSubs.includes(sid);
                    return `<div class="subsection">
                        ${userId ? `<button class="complete-btn ${isComplete ? 'completed' : ''}" data-topic="${i}" data-sub="${si}" title="${isComplete ? 'Mark incomplete' : 'Mark complete'}">
                            <i class="fa-solid ${isComplete ? 'fa-circle-check' : 'fa-circle'}"></i>
                        </button>` : ''}
                        <div class="subsection-title">${Utils.escapeHTML(sub.title)}</div>
                        <div class="subsection-duration">${sub.duration || ''}</div>
                        <a href="" class="subsection-link">
                            <button class="learn-btn">
                                <i class="fa-solid ${icon}"></i> ${label}
                            </button>
                        </a>
                    </div>`;
                }).join('');

                return `<div class="topic${i === 0 ? ' active' : ''}">
                    <div class="topic-bar">
                        <div class="title-section">
                            <div class="checkmark${isTopicComplete ? ' completed' : ''}">
                                <i class="fa-solid fa-circle-check"></i>
                            </div>
                            <div class="topic-name">
                                <span class="topic-number">${i + 1}</span>.
                                ${Utils.escapeHTML(topic.title)}
                            </div>
                        </div>
                        <div class="topic-metadata">
                            <div class="videos">
                                <i class="fa-solid fa-video"></i>
                                ${videos} Video${videos !== 1 ? 's' : ''}
                            </div>
                            <div class="quizzes">
                                <i class="fa-solid fa-clipboard-list"></i>
                                ${quizzes} Quiz${quizzes !== 1 ? 'zes' : ''}
                            </div>
                            ${courseProgress ? `<div class="topic-progress">${completed}/${total}</div>` : ''}
                        </div>
                        <div class="topic-dropdown-btn">
                            <i class="fa-solid fa-angle-down"></i>
                        </div>
                    </div>
                    <div class="dropdown-section">
                        ${subsectionsHTML}
                    </div>
                </div>`;
            }).join('');

            // Re-bind accordion after dynamic render
            topicsContainer.querySelectorAll('.topic').forEach(topic => {
                const bar = topic.querySelector('.topic-bar');
                bar.addEventListener('click', () => {
                    const isActive = topic.classList.contains('active');
                    topicsContainer.querySelectorAll('.topic').forEach(t => t.classList.remove('active'));
                    if (!isActive) topic.classList.add('active');
                });
                bar.setAttribute('role', 'button');
                bar.setAttribute('tabindex', '0');
                bar.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bar.click(); }
                });
            });

            // Bind complete buttons
            if (userId) {
                topicsContainer.querySelectorAll('.complete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const ti = parseInt(btn.dataset.topic);
                        const si = parseInt(btn.dataset.sub);
                        const sid = subId(ti, si);
                        const isComplete = courseProgress && courseProgress.completedSubs.includes(sid);

                        // Auto-enroll if not enrolled yet
                        if (!courseProgress) {
                            DataService.enrollInCourse(userId, courseId);
                            courseProgress = DataService.getCourseProgress(userId, courseId);
                            if (enrollBtn) enrollBtn.textContent = 'Continue Course';
                        }

                        if (isComplete) {
                            DataService.unmarkSubsectionComplete(userId, courseId, sid);
                        } else {
                            DataService.markSubsectionComplete(userId, courseId, sid);
                        }
                        courseProgress = DataService.getCourseProgress(userId, courseId);

                        // Update button icon
                        const icon = btn.querySelector('i');
                        const nowComplete = courseProgress.completedSubs.includes(sid);
                        btn.classList.toggle('completed', nowComplete);
                        icon.className = 'fa-solid ' + (nowComplete ? 'fa-circle-check' : 'fa-circle');
                        btn.title = nowComplete ? 'Mark incomplete' : 'Mark complete';

                        // Update topic checkmark
                        const topicEl = btn.closest('.topic');
                        const topicData = course.topics[ti];
                        const total = topicSubCount(topicData);
                        const completed = topicCompletedCount(ti, topicData);
                        const checkmark = topicEl.querySelector('.checkmark');
                        if (checkmark) {
                            checkmark.classList.toggle('completed', total > 0 && completed === total);
                        }
                        // Update topic progress counter
                        const progEl = topicEl.querySelector('.topic-progress');
                        if (progEl) progEl.textContent = `${completed}/${total}`;
                    });
                });
            }
        }
    }

    document.title = course.title + ' — LoopBridge Academy';
});

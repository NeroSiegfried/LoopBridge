document.addEventListener('components-loaded', async () => {
    'use strict';

    // Auth check
    const user = Auth.getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'author')) {
        window.location.href = '../pages/login.html';
        return;
    }

    const isAdmin = user.role === 'admin';

    // ─── Upload helper ───────────────────────────
    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('files', file);
        try {
            const res = await fetch('/api/uploads', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Upload failed');
            }
            const data = await res.json();
            return Array.isArray(data) ? data[0] : data;
        } catch (err) {
            console.error('[course-editor] Upload failed:', err);
            Utils.showToast('Upload failed: ' + err.message, 'error');
            return null;
        }
    }

    const courseId = Utils.getParam('id');
    const isEditing = !!courseId;
    let existingCourse = null;

    if (isEditing) {
        existingCourse = await DataService.getCourse(courseId);
        if (!existingCourse) {
            Utils.showToast('Course not found.', 'error');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            return;
        }

        document.getElementById('editor-title').textContent = 'Edit Course';
        document.title = 'Edit: ' + existingCourse.title + ' — LoopBridge';

        document.getElementById('title').value = existingCourse.title || '';
        document.getElementById('track').value = existingCourse.track || '';
        document.getElementById('duration').value = existingCourse.duration || '';
        const authorVal = existingCourse.author;
        document.getElementById('author').value =
            typeof authorVal === 'string' ? authorVal : (authorVal && authorVal.name ? authorVal.name : '');
        document.getElementById('description').value = existingCourse.description || '';

        if (existingCourse.objectives && Array.isArray(existingCourse.objectives)) {
            existingCourse.objectives.forEach(obj => addObjective(obj));
        }
        if (existingCourse.topics && Array.isArray(existingCourse.topics)) {
            existingCourse.topics.forEach(topic => addTopic(topic));
        }
    } else {
        document.getElementById('author').value = user.displayName || user.username || '';
    }

    // Author is always the current logged-in user (read-only)
    document.getElementById('author').value = user.displayName || user.username || '';

    // ─── Stats Update ────────────────────────────
    function updateStats() {
        const topicBlocks = document.querySelectorAll('.topic-block');
        const subRows = document.querySelectorAll('.subsection-row');
        let videoCount = 0;
        let quizCount = 0;

        subRows.forEach(row => {
            const typeSelect = row.querySelector('[data-field="type"]');
            const type = typeSelect ? typeSelect.value : 'video';
            if (type === 'video') videoCount++;
            // Count quizzes in this subsection
            const questions = row.querySelectorAll('.quiz-question');
            if (questions.length > 0) quizCount++;
        });

        document.getElementById('stat-topics').textContent = topicBlocks.length;
        document.getElementById('stat-videos').textContent = videoCount;
        document.getElementById('stat-quizzes').textContent = quizCount;
        document.getElementById('stat-lessons').textContent = subRows.length;

        // Update per-topic badges
        topicBlocks.forEach(block => {
            const subs = block.querySelectorAll('.subsection-row');
            let tv = 0, tq = 0;
            subs.forEach(s => {
                const tp = s.querySelector('[data-field="type"]');
                if (tp && tp.value === 'video') tv++;
                if (s.querySelectorAll('.quiz-question').length > 0) tq++;
            });
            const badges = block.querySelector('.topic-badges');
            if (badges) {
                badges.innerHTML = `
                    <span class="topic-badge videos">${tv} video${tv !== 1 ? 's' : ''}</span>
                    <span class="topic-badge quizzes">${tq} quiz${tq !== 1 ? 'zes' : ''}</span>
                `;
            }
        });
    }

    // ─── Objectives ──────────────────────────────
    const objectivesList = document.getElementById('objectives-list');

    function addObjective(text = '') {
        const row = document.createElement('div');
        row.className = 'objective-row';
        row.innerHTML = `
            <input class="input" type="text" placeholder="Learning objective" value="${Utils.escapeHTML(text)}">
            <button type="button" title="Remove"><i class="fa-solid fa-xmark"></i></button>
        `;
        objectivesList.appendChild(row);
        row.querySelector('button').addEventListener('click', () => row.remove());
    }

    document.getElementById('add-objective').addEventListener('click', () => addObjective());

    function getObjectives() {
        return Array.from(objectivesList.querySelectorAll('.objective-row input'))
            .map(input => input.value.trim()).filter(Boolean);
    }

    // ─── Topics ─────────────────────────────────
    const topicsEditor = document.getElementById('topics-editor');
    let topicIdCounter = 0;
    let quizGroupCounter = 0;

    function addTopic(data = null) {
        const topicId = 'topic-' + (topicIdCounter++);
        const block = document.createElement('div');
        block.className = 'topic-block';
        block.dataset.topicId = topicId;

        block.innerHTML = `
            <div class="topic-header">
                <input class="input" type="text" data-field="title" placeholder="Topic title" value="${data ? Utils.escapeHTML(data.title || '') : ''}">
                <div class="topic-badges"></div>
                <button type="button" title="Remove topic"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="topic-subsections" data-subs="${topicId}"></div>
            <button type="button" class="btn btn-sm btn-ghost add-subsection-btn" data-add-sub="${topicId}">
                <i class="fa-solid fa-plus"></i> Add Lesson
            </button>
        `;

        topicsEditor.appendChild(block);

        block.querySelector('.topic-header button').addEventListener('click', () => {
            block.remove();
            updateStats();
        });

        block.querySelector(`[data-add-sub="${topicId}"]`).addEventListener('click', () => {
            addSubsection(topicId);
        });

        if (data && data.subsections && Array.isArray(data.subsections)) {
            data.subsections.forEach(sub => addSubsection(topicId, sub));
        }

        updateStats();
    }

    function addSubsection(topicId, data = null) {
        const container = document.querySelector(`[data-subs="${topicId}"]`);
        const row = document.createElement('div');
        row.className = 'subsection-row';

        const currentType = data && data.type ? data.type : 'video';
        const quizGroupName = 'quiz-group-' + (quizGroupCounter++);

        row.innerHTML = `
            <div class="sub-top-row">
                <input class="input" type="text" data-field="title" placeholder="Lesson title" value="${data ? Utils.escapeHTML(data.title || '') : ''}">
                <input class="input" type="text" data-field="duration" placeholder="5 min" value="${data ? Utils.escapeHTML(data.duration || '') : ''}">
                <select class="input" data-field="type">
                    <option value="video" ${currentType === 'video' ? 'selected' : ''}>Video</option>
                    <option value="reading" ${currentType === 'reading' ? 'selected' : ''}>Reading</option>
                    <option value="exercise" ${currentType === 'exercise' ? 'selected' : ''}>Exercise</option>
                </select>
                <button type="button" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- Video upload area (shown when type=video) -->
            <div class="video-upload-area" ${currentType !== 'video' ? 'style="display:none"' : ''}>
                <label>
                    <i class="fa-solid fa-cloud-arrow-up"></i>
                    Choose video file…
                    <input type="file" accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg" data-field="video-file">
                </label>
                <div class="video-filename" data-field="video-name">${data && data.videoFile ? data.videoFile : 'No file selected'}</div>
            </div>

            <!-- Quiz builder -->
            <div class="quiz-builder">
                <div class="quiz-builder-header">
                    <span><i class="fa-solid fa-clipboard-question"></i> Quiz (optional)</span>
                    <button type="button" class="btn btn-sm btn-ghost add-question-btn" style="padding:0.25rem 0.5rem;font-size:0.75rem;">
                        <i class="fa-solid fa-plus"></i> Question
                    </button>
                </div>
                <div class="quiz-timing">
                    <label>Timing:</label>
                    <select data-field="quiz-timing">
                        <option value="end" ${data && data.quizTiming === 'inline' ? '' : 'selected'}>After lesson</option>
                        <option value="inline" ${data && data.quizTiming === 'inline' ? 'selected' : ''}>In-video (pauses video)</option>
                    </select>
                    <span class="inline-time-label" style="${data && data.quizTiming === 'inline' ? '' : 'display:none'}">at</span>
                    <input class="input" type="text" data-field="quiz-timestamp" placeholder="1:30" value="${data && data.quizTimestamp ? data.quizTimestamp : ''}" style="width:4rem;${data && data.quizTiming === 'inline' ? '' : 'display:none'}">
                </div>
                <div class="quiz-questions" data-quiz-group="${quizGroupName}"></div>
            </div>
        `;

        container.appendChild(row);

        // Type change → show/hide video upload
        const typeSelect = row.querySelector('[data-field="type"]');
        const videoArea = row.querySelector('.video-upload-area');
        typeSelect.addEventListener('change', () => {
            videoArea.style.display = typeSelect.value === 'video' ? '' : 'none';
            updateStats();
        });

        // Video file selection
        const fileInput = row.querySelector('[data-field="video-file"]');
        const fileNameEl = row.querySelector('[data-field="video-name"]');
        fileInput.addEventListener('change', async () => {
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                fileNameEl.textContent = 'Uploading…';

                const result = await uploadFile(file);
                if (result) {
                    fileNameEl.textContent = file.name;
                    fileInput.dataset.savedUrl = result.url;
                } else {
                    fileNameEl.textContent = 'Upload failed — ' + file.name;
                }
            }
        });

        // Quiz timing toggle
        const quizTiming = row.querySelector('[data-field="quiz-timing"]');
        const inlineLabel = row.querySelector('.inline-time-label');
        const timestampInput = row.querySelector('[data-field="quiz-timestamp"]');
        quizTiming.addEventListener('change', () => {
            const isInline = quizTiming.value === 'inline';
            inlineLabel.style.display = isInline ? '' : 'none';
            timestampInput.style.display = isInline ? '' : 'none';
        });

        // Add question button
        const questionsContainer = row.querySelector(`[data-quiz-group="${quizGroupName}"]`);
        row.querySelector('.add-question-btn').addEventListener('click', () => {
            addQuizQuestion(questionsContainer, quizGroupName);
            updateStats();
        });

        // Remove lesson
        row.querySelector('.sub-top-row button').addEventListener('click', () => {
            row.remove();
            updateStats();
        });

        // Load existing quiz questions
        if (data && data.quiz && Array.isArray(data.quiz)) {
            data.quiz.forEach(q => addQuizQuestion(questionsContainer, quizGroupName, q));
        }

        updateStats();
    }

    function addQuizQuestion(container, groupName, data = null) {
        const qEl = document.createElement('div');
        qEl.className = 'quiz-question';

        const options = data && data.options ? data.options : ['', '', '', ''];
        const correct = data && data.correct !== undefined ? data.correct : 0;

        qEl.innerHTML = `
            <input class="input question-input" type="text" placeholder="Question text" value="${data ? Utils.escapeHTML(data.question || '') : ''}">
            <div class="quiz-options">
                ${options.map((opt, i) => `
                    <div class="quiz-option">
                        <input type="radio" name="${groupName}-${container.children.length}" ${i === correct ? 'checked' : ''}>
                        <input class="input" type="text" placeholder="Option ${i + 1}" value="${Utils.escapeHTML(opt)}">
                        <button type="button" class="remove-option" title="Remove option"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `).join('')}
            </div>
            <div class="quiz-question-actions">
                <button type="button" class="btn btn-sm btn-ghost add-option-btn" style="font-size:0.7rem;padding:0.15rem 0.4rem;">
                    <i class="fa-solid fa-plus"></i> Option
                </button>
                <button type="button" class="btn btn-sm btn-ghost remove-question-btn" style="font-size:0.7rem;padding:0.15rem 0.4rem;color:#e53e3e;">
                    <i class="fa-solid fa-trash"></i> Remove
                </button>
            </div>
        `;

        container.appendChild(qEl);

        // Remove question
        qEl.querySelector('.remove-question-btn').addEventListener('click', () => {
            qEl.remove();
            updateStats();
        });

        // Add option
        qEl.querySelector('.add-option-btn').addEventListener('click', () => {
            const optionsDiv = qEl.querySelector('.quiz-options');
            const optCount = optionsDiv.children.length;
            const radioName = `${groupName}-${Array.from(container.children).indexOf(qEl)}`;
            const optEl = document.createElement('div');
            optEl.className = 'quiz-option';
            optEl.innerHTML = `
                <input type="radio" name="${radioName}">
                <input class="input" type="text" placeholder="Option ${optCount + 1}">
                <button type="button" class="remove-option" title="Remove option"><i class="fa-solid fa-xmark"></i></button>
            `;
            optionsDiv.appendChild(optEl);
            optEl.querySelector('.remove-option').addEventListener('click', () => optEl.remove());
        });

        // Wire remove-option for existing options
        qEl.querySelectorAll('.remove-option').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.quiz-option').remove());
        });
    }

    document.getElementById('add-topic').addEventListener('click', () => addTopic());

    // ─── Get Topics Data ─────────────────────────
    function getTopics() {
        const topics = [];
        topicsEditor.querySelectorAll('.topic-block').forEach(block => {
            const titleInput = block.querySelector('[data-field="title"]');
            const title = titleInput ? titleInput.value.trim() : '';
            if (!title) return;

            const subsections = [];
            block.querySelectorAll('.subsection-row').forEach(subRow => {
                const subTitle = subRow.querySelector('[data-field="title"]').value.trim();
                const subDuration = subRow.querySelector('[data-field="duration"]').value.trim();
                const subType = subRow.querySelector('[data-field="type"]').value;

                if (!subTitle) return;

                const sub = {
                    title: subTitle,
                    duration: subDuration || '5 min',
                    type: subType
                };

                // Video file
                const videoFileInput = subRow.querySelector('[data-field="video-file"]');
                const videoNameEl = subRow.querySelector('[data-field="video-name"]');
                if (videoFileInput && videoFileInput.dataset.savedUrl) {
                    sub.videoFile = videoFileInput.dataset.savedUrl;
                } else if (videoNameEl && videoNameEl.textContent !== 'No file selected' && videoNameEl.textContent !== 'Uploading…') {
                    sub.videoFile = videoNameEl.textContent;
                }

                // Quiz
                const quizTiming = subRow.querySelector('[data-field="quiz-timing"]').value;
                const quizTimestamp = subRow.querySelector('[data-field="quiz-timestamp"]').value;
                const questionsEls = subRow.querySelectorAll('.quiz-question');

                if (questionsEls.length > 0) {
                    sub.quizTiming = quizTiming;
                    if (quizTiming === 'inline') sub.quizTimestamp = quizTimestamp;

                    sub.quiz = [];
                    questionsEls.forEach(qEl => {
                        const question = qEl.querySelector('.question-input').value.trim();
                        const options = [];
                        let correct = 0;
                        qEl.querySelectorAll('.quiz-option').forEach((optEl, i) => {
                            options.push(optEl.querySelector('input[type="text"]').value.trim());
                            if (optEl.querySelector('input[type="radio"]').checked) correct = i;
                        });
                        if (question) {
                            sub.quiz.push({ question, options, correct });
                        }
                    });
                }

                subsections.push(sub);
            });

            topics.push({ title, subsections });
        });
        return topics;
    }

    // ─── Save ────────────────────────────────────
    async function saveCourse() {
        const saveBtn = document.getElementById('save-btn');
        const saveHeaderBtn = document.getElementById('save-header-btn');
        saveBtn.textContent = 'Saving…';
        saveBtn.disabled = true;
        saveHeaderBtn.disabled = true;

        const courseData = {
            title: document.getElementById('title').value.trim(),
            track: document.getElementById('track').value,
            duration: document.getElementById('duration').value.trim(),
            author: document.getElementById('author').value.trim() || user.displayName,
            description: document.getElementById('description').value.trim(),
            objectives: getObjectives(),
            topics: getTopics(),
            ownerId: user.id || user.username
        };

        // Admins auto-approve; authors need admin approval
        if (!isEditing) {
            courseData.approved = isAdmin;
        }

        try {
            if (isEditing) {
                await DataService.updateCourse(courseId, courseData);
                Utils.showToast('Course updated!', 'success');
            } else {
                const newCourse = await DataService.createCourse(courseData);
                if (isAdmin) {
                    Utils.showToast('Course created!', 'success');
                } else {
                    Utils.showToast('Course created! It will appear on the site once approved by an admin.', 'info');
                }
                setTimeout(() => {
                    window.location.href = 'edit-course.html?id=' + newCourse.id;
                }, 800);
                return;
            }
        } catch (err) {
            Utils.showToast('Failed to save: ' + err.message, 'error');
        }

        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Course';
        saveBtn.disabled = false;
        saveHeaderBtn.disabled = false;
    }

    document.getElementById('course-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCourse();
    });

    document.getElementById('save-header-btn').addEventListener('click', () => {
        if (document.getElementById('course-form').reportValidity()) {
            saveCourse();
        }
    });

    // Initial stats
    updateStats();
});

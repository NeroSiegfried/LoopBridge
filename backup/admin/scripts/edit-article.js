document.addEventListener('components-loaded', async () => {
    'use strict';

    // ─── Auth check ──────────────────────────────
    const user = Auth.getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'author')) {
        window.location.href = '../pages/login.html';
        return;
    }

    const isAdmin = user.role === 'admin';

    // Only admins can set an article as featured
    if (!isAdmin) {
        document.getElementById('featured-group').style.display = 'none';
    }

    const articleId = Utils.getParam('id');
    const isEditing = !!articleId;
    let existingArticle = null;

    // Track uploaded files via object URLs
    let coverObjectUrl = '';
    const blockFileUrls = {}; // blockId -> objectUrl

    // ─── File Upload Helper ──────────────────────
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
            // Single file returns an object, multiple returns an array
            return Array.isArray(data) ? data[0] : data;
        } catch (err) {
            console.error('[editor] Upload failed:', err);
            Utils.showToast('Upload failed: ' + err.message, 'error');
            return null;
        }
    }

    if (isEditing) {
        existingArticle = await DataService.getArticle(articleId);
        if (!existingArticle) {
            Utils.showToast('Article not found.', 'error');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
            return;
        }

        document.getElementById('editor-title').textContent = 'Edit Article';
        document.title = 'Edit: ' + existingArticle.title + ' — LoopBridge';

        // Populate form fields
        document.getElementById('title').value = existingArticle.title || '';
        document.getElementById('category').value = existingArticle.category || '';

        const authorVal = existingArticle.author;
        document.getElementById('author-name').value =
            typeof authorVal === 'string' ? authorVal : (authorVal && authorVal.name ? authorVal.name : '');

        document.getElementById('excerpt').value = existingArticle.excerpt || existingArticle.description || '';

        // Cover image: show existing
        if (existingArticle.image) {
            coverObjectUrl = existingArticle.image;
            document.getElementById('cover-filename').textContent = existingArticle.image.split('/').pop() || 'Existing image';
        }

        document.getElementById('featured').checked = !!existingArticle.featured;

        // Populate content blocks
        if (existingArticle.content && Array.isArray(existingArticle.content)) {
            existingArticle.content.forEach(block => addBlock(block));
        }
    } else {
        document.getElementById('author-name').value = user.displayName || user.username || '';
    }

    // Author is always the current logged-in user (read-only)
    document.getElementById('author-name').value = user.displayName || user.username || '';

    // ─── Cover image upload ──────────────────────
    const coverInput = document.getElementById('cover-upload');
    const coverFilename = document.getElementById('cover-filename');
    coverInput.addEventListener('change', async () => {
        if (coverInput.files.length > 0) {
            const file = coverInput.files[0];
            coverFilename.textContent = 'Uploading…';

            // Show preview immediately via blob URL
            if (coverObjectUrl && coverObjectUrl.startsWith('blob:')) {
                URL.revokeObjectURL(coverObjectUrl);
            }
            coverObjectUrl = URL.createObjectURL(file);
            updatePreview();

            // Upload to server
            const result = await uploadFile(file);
            if (result) {
                coverInput.dataset.savedFilename = result.url;
                coverObjectUrl = result.url;
                coverFilename.textContent = file.name;
            } else {
                coverFilename.textContent = 'Upload failed — ' + file.name;
            }
            updatePreview();
        }
    });

    // ─── Content blocks management ───────────────
    const blocksContainer = document.getElementById('content-blocks');
    let blockIdCounter = 0;

    function addBlock(data = null) {
        const type = data ? data.type : 'paragraph';
        const id = 'block-' + (blockIdCounter++);

        const blockEl = document.createElement('div');
        blockEl.className = 'content-block';
        blockEl.dataset.blockId = id;
        blockEl.dataset.blockType = type;

        let fieldHTML = '';
        if (type === 'heading') {
            fieldHTML = `
                <select class="input" data-field="level" style="width:auto;margin-bottom:0.375rem;">
                    <option value="2" ${data && data.level === 2 ? 'selected' : ''}>H2</option>
                    <option value="3" ${data && data.level === 3 ? 'selected' : ''}>H3</option>
                </select>
                <input class="input" type="text" data-field="text" placeholder="Heading text" value="${data ? Utils.escapeHTML(data.text || '') : ''}">
            `;
        } else if (type === 'paragraph') {
            fieldHTML = `
                <textarea class="input textarea" data-field="text" rows="3" placeholder="Write your paragraph…">${data ? Utils.escapeHTML(data.text || '') : ''}</textarea>
            `;
        } else if (type === 'list') {
            const items = data && data.items ? data.items.join('\n') : '';
            fieldHTML = `
                <label style="font-size:0.75rem;color:var(--black-mid);display:flex;align-items:center;gap:0.375rem;">
                    <input type="checkbox" data-field="ordered" ${data && data.ordered ? 'checked' : ''}> Ordered list
                </label>
                <textarea class="input textarea" data-field="items" rows="3" placeholder="One item per line">${Utils.escapeHTML(items)}</textarea>
            `;
        } else if (type === 'blockquote') {
            fieldHTML = `
                <textarea class="input textarea" data-field="text" rows="2" placeholder="Quote text…">${data ? Utils.escapeHTML(data.text || '') : ''}</textarea>
            `;
        } else if (type === 'image') {
            const fileId = 'file-' + id;
            fieldHTML = `
                <div class="block-file-upload">
                    <label>
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span class="block-file-name-label" id="fname-${id}">${data && data.src ? data.src.split('/').pop() : 'Choose image\u2026'}</span>
                        <input type="file" accept="image/*" data-field="file" id="${fileId}">
                    </label>
                </div>
                <input class="input" type="text" data-field="alt" placeholder="Alt text (optional)" value="${data ? Utils.escapeHTML(data.alt || '') : ''}" style="margin-top:0.25rem;">
            `;
        } else if (type === 'video') {
            const fileId = 'file-' + id;
            fieldHTML = `
                <div class="block-file-upload">
                    <label>
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span class="block-file-name-label" id="fname-${id}">${data && data.src ? data.src.split('/').pop() : 'Choose video\u2026'}</span>
                        <input type="file" accept="video/mp4,video/webm,video/ogg" data-field="file" id="${fileId}">
                    </label>
                </div>
                <input class="input" type="text" data-field="caption" placeholder="Caption (optional)" value="${data ? Utils.escapeHTML(data.caption || '') : ''}" style="margin-top:0.25rem;">
            `;
        } else if (type === 'audio') {
            const fileId = 'file-' + id;
            fieldHTML = `
                <div class="block-file-upload">
                    <label>
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span class="block-file-name-label" id="fname-${id}">${data && data.src ? data.src.split('/').pop() : 'Choose audio\u2026'}</span>
                        <input type="file" accept="audio/mpeg,audio/ogg,audio/wav" data-field="file" id="${fileId}">
                    </label>
                </div>
                <input class="input" type="text" data-field="caption" placeholder="Caption (optional)" value="${data ? Utils.escapeHTML(data.caption || '') : ''}" style="margin-top:0.25rem;">
            `;
        } else if (type === 'embed') {
            fieldHTML = `
                <input class="input" type="text" data-field="src" placeholder="Embed URL (YouTube, Twitter, etc.)" value="${data ? Utils.escapeHTML(data.src || '') : ''}">
                <input class="input" type="text" data-field="caption" placeholder="Caption (optional)" value="${data ? Utils.escapeHTML(data.caption || '') : ''}" style="margin-top:0.25rem;">
            `;
        }

        blockEl.innerHTML = `
            <span class="block-handle" title="Drag to reorder">
                <i class="fa-solid fa-grip-vertical"></i>
            </span>
            <div class="block-body">
                <span class="block-label">${type}</span>
                ${fieldHTML}
            </div>
            <div class="block-actions">
                <button type="button" title="Move up" data-move-up="${id}">
                    <i class="fa-solid fa-chevron-up"></i>
                </button>
                <button type="button" title="Move down" data-move-down="${id}">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
                <button type="button" title="Remove" data-remove="${id}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;

        blocksContainer.appendChild(blockEl);

        // Event handlers
        blockEl.querySelector(`[data-remove="${id}"]`).addEventListener('click', () => {
            blockEl.remove();
            updatePreview();
        });

        blockEl.querySelector(`[data-move-up="${id}"]`).addEventListener('click', () => {
            const prev = blockEl.previousElementSibling;
            if (prev) {
                blocksContainer.insertBefore(blockEl, prev);
                updatePreview();
            }
        });

        blockEl.querySelector(`[data-move-down="${id}"]`).addEventListener('click', () => {
            const next = blockEl.nextElementSibling;
            if (next) {
                blocksContainer.insertBefore(next, blockEl);
                updatePreview();
            }
        });

        // Live update preview on input
        blockEl.querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
        });

        // File upload handler for media blocks
        const fileInput = blockEl.querySelector('[data-field="file"]');
        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const labelEl = document.getElementById('fname-' + id);
                    if (labelEl) labelEl.textContent = 'Uploading…';

                    // Show preview immediately via blob URL
                    if (blockFileUrls[id] && blockFileUrls[id].startsWith('blob:')) {
                        URL.revokeObjectURL(blockFileUrls[id]);
                    }
                    blockFileUrls[id] = URL.createObjectURL(file);
                    updatePreview();

                    // Upload to server
                    const result = await uploadFile(file);
                    if (result) {
                        fileInput.dataset.savedFilename = result.url;
                        blockFileUrls[id] = result.url;
                        if (labelEl) labelEl.textContent = file.name;
                    } else {
                        if (labelEl) labelEl.textContent = 'Upload failed — ' + file.name;
                    }
                    updatePreview();
                }
            });
            // Restore existing data src as an initial URL
            if (data && data.src) {
                blockFileUrls[id] = data.src;
            }
        }

        updatePreview();
    }

    // Add block buttons
    document.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            addBlock({ type: btn.dataset.add });
            // Scroll to new block
            blocksContainer.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });

    // ─── Build content array from blocks ─────────
    function getContentBlocks() {
        const blocks = [];
        blocksContainer.querySelectorAll('.content-block').forEach(blockEl => {
            const type = blockEl.dataset.blockType;
            const block = { type };

            if (type === 'heading') {
                block.text = blockEl.querySelector('[data-field="text"]').value;
                block.level = parseInt(blockEl.querySelector('[data-field="level"]').value);
            } else if (type === 'paragraph' || type === 'blockquote') {
                block.text = blockEl.querySelector('[data-field="text"]').value;
            } else if (type === 'list') {
                block.items = blockEl.querySelector('[data-field="items"]').value
                    .split('\n').map(s => s.trim()).filter(Boolean);
                block.ordered = blockEl.querySelector('[data-field="ordered"]').checked;
            } else if (type === 'image') {
                const fileInput = blockEl.querySelector('[data-field="file"]');
                block.src = fileInput && fileInput.dataset.savedFilename
                    ? fileInput.dataset.savedFilename
                    : (blockFileUrls[blockEl.dataset.blockId] || '');
                block.alt = blockEl.querySelector('[data-field="alt"]').value;
            } else if (type === 'video') {
                const fileInput = blockEl.querySelector('[data-field="file"]');
                block.src = fileInput && fileInput.dataset.savedFilename
                    ? fileInput.dataset.savedFilename
                    : (blockFileUrls[blockEl.dataset.blockId] || '');
                block.caption = blockEl.querySelector('[data-field="caption"]')?.value || '';
            } else if (type === 'audio') {
                const fileInput = blockEl.querySelector('[data-field="file"]');
                block.src = fileInput && fileInput.dataset.savedFilename
                    ? fileInput.dataset.savedFilename
                    : (blockFileUrls[blockEl.dataset.blockId] || '');
                block.caption = blockEl.querySelector('[data-field="caption"]')?.value || '';
            } else if (type === 'embed') {
                block.src = blockEl.querySelector('[data-field="src"]').value;
                block.caption = blockEl.querySelector('[data-field="caption"]')?.value || '';
            }

            blocks.push(block);
        });
        return blocks;
    }

    // ─── Live Preview ────────────────────────────
    const debouncedPreview = Utils.debounce(updatePreview, 150);
    ['title', 'category', 'author-name', 'excerpt', 'cover-url'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', debouncedPreview);
            el.addEventListener('change', debouncedPreview);
        }
    });

    function updatePreview() {
        // Title
        const title = document.getElementById('title').value.trim();
        document.getElementById('preview-title').textContent = title || 'Article Title';

        // Meta
        const cat = document.getElementById('category').value || 'Category';
        document.getElementById('preview-category').textContent = cat;
        document.getElementById('preview-date').textContent = Utils.formatDate(new Date().toISOString());

        // Read time
        const blocks = getContentBlocks();
        document.getElementById('preview-readtime').textContent = Utils.readingTime(blocks);

        // Cover image
        const coverEl = document.getElementById('preview-cover');
        if (coverObjectUrl) {
            let previewSrc;
            if (coverObjectUrl.startsWith('blob:') || coverObjectUrl.startsWith('/')) {
                previewSrc = coverObjectUrl;
            } else {
                previewSrc = '../' + coverObjectUrl.replace(/^\.\//, '');
            }
            coverEl.innerHTML = `<img src="${previewSrc}" alt="${Utils.escapeHTML(title)}" onerror="this.parentElement.innerHTML='<span>Image not found</span>'">`;
        } else {
            coverEl.innerHTML = '<span>Cover image preview</span>';
        }

        // Body
        const bodyEl = document.getElementById('preview-body');
        if (blocks.length === 0) {
            bodyEl.innerHTML = `
                <div class="preview-empty">
                    <i class="fa-solid fa-pen-nib"></i>
                    Start writing — your article appears here in real time.
                </div>
            `;
            return;
        }

        bodyEl.innerHTML = blocks.map((block, idx) => {
            const blockEls = blocksContainer.querySelectorAll('.content-block');
            const blockEl = blockEls[idx];
            const blockId = blockEl ? blockEl.dataset.blockId : '';

            switch (block.type) {
                case 'heading': {
                    const tag = block.level === 3 ? 'h3' : 'h2';
                    return block.text ? `<${tag}>${Utils.escapeHTML(block.text)}</${tag}>` : '';
                }
                case 'paragraph':
                    return block.text ? `<p>${Utils.escapeHTML(block.text)}</p>` : '';
                case 'list': {
                    if (!block.items || block.items.length === 0) return '';
                    const items = block.items.map(i => `<li>${Utils.escapeHTML(i)}</li>`).join('');
                    return block.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
                }
                case 'blockquote':
                    return block.text ? `<blockquote>${Utils.escapeHTML(block.text)}</blockquote>` : '';
                case 'image': {
                    const mediaSrc = blockFileUrls[blockId] || block.src;
                    if (!mediaSrc) return '';
                    const imgSrc = (mediaSrc.startsWith('blob:') || mediaSrc.startsWith('/')) ? mediaSrc
                        : '../' + mediaSrc.replace(/^\.\//,  '');
                    return `<img src="${imgSrc}" alt="${Utils.escapeHTML(block.alt || '')}" onerror="this.style.display='none'">`;
                }
                case 'video': {
                    const mediaSrc = blockFileUrls[blockId] || block.src;
                    if (!mediaSrc) return '';
                    const vidSrc = (mediaSrc.startsWith('blob:') || mediaSrc.startsWith('/')) ? mediaSrc
                        : '../' + mediaSrc.replace(/^\.\//,  '');
                    return `<video controls style="max-width:100%;border-radius:8px;margin:1rem 0;"><source src="${vidSrc}"></video>`
                        + (block.caption ? `<p style="font-size:0.875rem;color:var(--black-mid);text-align:center;margin-top:0.25rem;"><em>${Utils.escapeHTML(block.caption)}</em></p>` : '');
                }
                case 'audio': {
                    const mediaSrc = blockFileUrls[blockId] || block.src;
                    if (!mediaSrc) return '';
                    const audSrc = (mediaSrc.startsWith('blob:') || mediaSrc.startsWith('/')) ? mediaSrc
                        : '../' + mediaSrc.replace(/^\.\//,  '');
                    return `<audio controls style="width:100%;margin:1rem 0;"><source src="${audSrc}"></audio>`
                        + (block.caption ? `<p style="font-size:0.875rem;color:var(--black-mid);text-align:center;margin-top:0.25rem;"><em>${Utils.escapeHTML(block.caption)}</em></p>` : '');
                }
                case 'embed': {
                    if (!block.src) return '';
                    let embedSrc = block.src;
                    const ytMatch = embedSrc.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                    if (ytMatch) embedSrc = `https://www.youtube.com/embed/${ytMatch[1]}`;
                    return `<iframe src="${Utils.escapeHTML(embedSrc)}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:8px;margin:1rem 0;" allowfullscreen></iframe>`
                        + (block.caption ? `<p style="font-size:0.875rem;color:var(--black-mid);text-align:center;margin-top:0.25rem;"><em>${Utils.escapeHTML(block.caption)}</em></p>` : '');
                }
                default:
                    return '';
            }
        }).filter(Boolean).join('\n');
    }

    // Initial preview render
    updatePreview();

    // ─── Save ────────────────────────────────────
    async function saveArticle() {
        const saveBtn = document.getElementById('save-btn');
        const saveHeaderBtn = document.getElementById('save-header-btn');
        saveBtn.textContent = 'Saving…';
        saveBtn.disabled = true;
        saveHeaderBtn.disabled = true;

        const authorInput = document.getElementById('author-name').value.trim() || user.displayName;
        const catRaw = document.getElementById('category').value.trim();
        const categories = catRaw.split(',').map(c => c.trim()).filter(Boolean);
        const primaryCategory = categories[0] || '';

        const coverUpload = document.getElementById('cover-upload');
        let coverImagePath = './images/article-pic.jpg';
        if (coverUpload && coverUpload.dataset.savedFilename) {
            coverImagePath = coverUpload.dataset.savedFilename;
        } else if (coverObjectUrl && !coverObjectUrl.startsWith('blob:')) {
            coverImagePath = coverObjectUrl;
        }

        const articleData = {
            title: document.getElementById('title').value.trim(),
            category: primaryCategory,
            categories: categories,
            author: {
                name: authorInput,
                avatar: './images/user-placeholder.svg'
            },
            description: document.getElementById('excerpt').value.trim(),
            excerpt: document.getElementById('excerpt').value.trim(),
            image: coverImagePath,
            featured: isAdmin ? document.getElementById('featured').checked : false,
            content: getContentBlocks(),
            ownerId: user.id || user.username
        };

        try {
            if (isEditing) {
                await DataService.updateArticle(articleId, articleData);
                Utils.showToast('Article updated!', 'success');
            } else {
                articleData.publishedAt = new Date().toISOString();
                articleData.readTime = Utils.readingTime(articleData.content);
                const newArticle = await DataService.createArticle(articleData);
                Utils.showToast('Article created!', 'success');
                setTimeout(() => {
                    window.location.href = 'edit-article.html?id=' + newArticle.id;
                }, 800);
                return;
            }
        } catch (err) {
            Utils.showToast('Failed to save: ' + err.message, 'error');
        }

        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Article';
        saveBtn.disabled = false;
        saveHeaderBtn.disabled = false;
    }

    document.getElementById('article-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveArticle();
    });

    document.getElementById('save-header-btn').addEventListener('click', () => {
        if (document.getElementById('article-form').reportValidity()) {
            saveArticle();
        }
    });
});

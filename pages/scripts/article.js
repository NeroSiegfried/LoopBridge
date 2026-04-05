document.addEventListener('components-loaded', async () => {
    const articleId = Utils.getParam('id');
    if (!articleId) {
        document.getElementById('article-title').textContent = 'Article Not Found';
        return;
    }

    const article = await DataService.getArticle(articleId);
    if (!article) {
        document.getElementById('article-title').textContent = 'Article Not Found';
        document.getElementById('article-body').innerHTML = '<p>The article you\'re looking for doesn\'t exist or has been removed.</p>';
        return;
    }

    // Set page title
    document.title = article.title + ' — LoopBridge';

    // Title
    document.getElementById('article-title').textContent = article.title;

    // Helpers
    function authorName(a) {
        if (!a) return 'LoopBridge Team';
        if (typeof a === 'string') return a;
        return a.name || 'LoopBridge Team';
    }
    function authorAvatar(a) {
        if (!a || typeof a === 'string') return '';
        return a.avatar || '';
    }

    const aName = authorName(article.author);
    const aAvatar = authorAvatar(article.author);

    // Meta — matches backup layout: author-info (left) | other-info with date/time pills (right)
    const metaEl = document.getElementById('article-meta');
    metaEl.innerHTML = `
        <div class="author-info">
            <div class="author-image">
                ${aAvatar ? `<img src="../${aAvatar}" alt="${Utils.escapeHTML(aName)}">` : ''}
            </div>
            <span class="author-name">${Utils.escapeHTML(aName)}</span>
        </div>
        <div class="other-info">
            <div class="date">${Utils.formatDate(article.publishedAt || article.createdAt)}</div>
            <div class="time">${article.content ? Utils.readingTime(article.content) : '5 min read'}</div>
        </div>
    `;

    // Cover image
    const coverEl = document.getElementById('article-cover');
    const img = article.image || article.coverImage || article.thumbnail || '';
    if (img) {
        // images stored as ./images/... relative to root
        const src = img.startsWith('./') ? '../' + img.substring(2) : '../' + img;
        coverEl.innerHTML = `<img src="${src}" alt="${Utils.escapeHTML(article.title)}">`;
    }

    // Admin bar — show if admin or if logged-in user authored this article
    const currentUser = Auth.getCurrentUser();
    const isOwner = currentUser && (
        Auth.canEdit(articleId) ||
        (currentUser.displayName && currentUser.displayName === aName)
    );

    if (isOwner) {
        const adminBar = document.getElementById('article-admin-bar');
        adminBar.innerHTML = `
            <div class="article-admin-bar">
                <a href="../admin/edit-article.html?id=${articleId}" class="btn btn-sm btn-ghost">
                    <i class="fa-solid fa-pen"></i> Edit Article
                </a>
                <button class="btn btn-sm btn-danger" id="delete-article-btn">
                    <i class="fa-solid fa-trash"></i> Delete Article
                </button>
            </div>
        `;

        document.getElementById('delete-article-btn').addEventListener('click', async () => {
            const confirmed = await Utils.confirm('Are you sure you want to delete this article?', 'Delete Article');
            if (confirmed) {
                try {
                    await DataService.deleteArticle(articleId);
                    Utils.showToast('Article deleted.', 'success');
                    setTimeout(() => window.location.href = '../blog.html', 1000);
                } catch (err) {
                    Utils.showToast('Failed to delete.', 'error');
                }
            }
        });
    }

    // Render content body
    const bodyEl = document.getElementById('article-body');
    if (article.content && Array.isArray(article.content)) {
        bodyEl.innerHTML = renderContent(article.content);
    } else {
        bodyEl.innerHTML = '<p>No content available.</p>';
    }

    // Related articles (same category first, then any others — up to 3)
    const allArticles = await DataService.getArticles();
    const visibleArticles = allArticles.filter(a => !a.deleted);
    let related = visibleArticles
        .filter(a => a.id !== articleId && a.category === article.category)
        .slice(0, 3);

    if (related.length < 3) {
        const needed = 3 - related.length;
        const relatedIds = new Set(related.map(r => r.id));
        const others = visibleArticles
            .filter(a => a.id !== articleId && !relatedIds.has(a.id))
            .slice(0, needed);
        related = related.concat(others);
    }

    const relatedGrid = document.getElementById('related-grid');
    if (related.length > 0) {
        relatedGrid.innerHTML = related.map(a => {
            const imgPath = a.image ? (a.image.startsWith('./') ? '../' + a.image.substring(2) : '../' + a.image) : '';
            return `
                <a href="article.html?id=${a.id}" class="card" style="text-decoration:none;">
                    <div class="card-image" ${imgPath ? `style="background-image:url('${imgPath}');background-size:cover;background-position:center;"` : ''}>
                        ${!imgPath ? '<div style="width:100%;height:100%;background-color:#e9fded;"></div>' : ''}
                    </div>
                    <div class="card-body">
                        <span style="font-size:0.8125rem;color:var(--black-mid);">${a.category || 'General'}</span>
                        <h3 style="font-family:var(--font-heading-variable);font-size:1.125rem;font-weight:600;color:var(--lb-blue-text);margin:0.25rem 0;">${Utils.escapeHTML(a.title)}</h3>
                        <p style="font-family:var(--font-body);font-size:0.875rem;color:var(--black-mid);font-weight:300;line-height:1.5;">${Utils.truncate(a.description || '', 100)}</p>
                        <span style="font-size:0.8125rem;color:var(--black-mid);font-weight:300;margin-top:auto;">${a.readTime || Utils.readingTime(a.content || [])}</span>
                    </div>
                </a>
            `;
        }).join('');
    } else {
        relatedGrid.innerHTML = '<p style="grid-column:1/-1;color:var(--black-mid);text-align:center;">No related articles found.</p>';
    }
});

/**
 * Render content blocks to HTML.
 */
function renderContent(blocks) {
    function mediaSrc(src) {
        if (!src) return '';
        // Absolute paths (from uploads) stay as-is; relative ./ paths get ../
        if (src.startsWith('/') || src.startsWith('http')) return src;
        return '../' + src.replace(/^\.\//,  '');
    }

    return blocks.map(block => {
        switch (block.type) {
            case 'heading': {
                const tag = block.level === 3 ? 'h3' : 'h2';
                return `<${tag}>${Utils.escapeHTML(block.text)}</${tag}>`;
            }
            case 'paragraph':
                return `<p>${Utils.escapeHTML(block.text)}</p>`;
            case 'list': {
                const items = (block.items || []).map(i => `<li>${Utils.escapeHTML(i)}</li>`).join('');
                return block.ordered
                    ? `<ol>${items}</ol>`
                    : `<ul>${items}</ul>`;
            }
            case 'blockquote':
                return `<blockquote>${Utils.escapeHTML(block.text)}</blockquote>`;
            case 'image': {
                const src = mediaSrc(block.src);
                if (!src) return '';
                const alt = block.alt ? Utils.escapeHTML(block.alt) : '';
                return `<figure class="article-media"><img src="${src}" alt="${alt}" loading="lazy">${block.caption ? `<figcaption>${Utils.escapeHTML(block.caption)}</figcaption>` : ''}</figure>`;
            }
            case 'video': {
                const src = mediaSrc(block.src);
                if (!src) return '';
                return `<figure class="article-media"><video controls preload="metadata" style="max-width:100%;border-radius:8px;"><source src="${src}"></video>${block.caption ? `<figcaption>${Utils.escapeHTML(block.caption)}</figcaption>` : ''}</figure>`;
            }
            case 'audio': {
                const src = mediaSrc(block.src);
                if (!src) return '';
                return `<figure class="article-media"><audio controls style="width:100%;"><source src="${src}"></audio>${block.caption ? `<figcaption>${Utils.escapeHTML(block.caption)}</figcaption>` : ''}</figure>`;
            }
            case 'embed': {
                if (!block.src) return '';
                let embedUrl = block.src;
                const ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
                if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
                return `<figure class="article-media"><iframe src="${Utils.escapeHTML(embedUrl)}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:8px;" allowfullscreen loading="lazy"></iframe>${block.caption ? `<figcaption>${Utils.escapeHTML(block.caption)}</figcaption>` : ''}</figure>`;
            }
            default:
                return '';
        }
    }).join('\n');
}

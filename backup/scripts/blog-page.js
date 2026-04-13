document.addEventListener('components-loaded', async () => {
    const articles = await DataService.getArticles();
    const PAGE_SIZE = 6;
    let feedPage = 0;
    let activeCategory = 'All';
    let activeSortLabel = 'Recently Published';

    function authorName(a) {
        if (!a.author) return 'LoopBridge Team';
        if (typeof a.author === 'string') return a.author;
        return a.author.name || 'LoopBridge Team';
    }

    // ─── Featured articles ───────────────────────────
    const featuredEl = document.getElementById('featured-articles');
    const featured = articles.filter(a => a.featured).slice(0, 3);
    if (featured.length && featuredEl) {
        featuredEl.innerHTML = featured.map(a => `
            <a href="./pages/article.html?id=${a.id}" class="article-card">
                <div class="article-image" ${a.image ? `style="background-image:url('${a.image}');background-size:cover;background-position:center;"` : ''}></div>
                <div class="article-category">${a.category || 'General'}</div>
                <h3 class="article-title">${Utils.escapeHTML(a.title)}</h3>
                <p class="article-description">${a.readTime || '5 min read'}</p>
            </a>
        `).join('');
    }

    // ─── Dynamic category buttons ────────────────────
    const catBtnContainer = document.querySelector('.feed .category-buttons');
    if (catBtnContainer) {
        const cats = [...new Set(articles.map(a => a.category).filter(Boolean))];
        catBtnContainer.innerHTML = '<button class="category-button active">All</button>' +
            cats.map(c => `<button class="category-button">${Utils.escapeHTML(c)}</button>`).join('');
    }

    // ─── Sorting helpers ─────────────────────────────
    function sortArticles(list) {
        const sorted = [...list];
        switch (activeSortLabel) {
            case 'Recently Updated':
                return sorted.sort((a, b) => new Date(b.updatedAt || b.publishedAt) - new Date(a.updatedAt || a.publishedAt));
            case 'Most Read':
                return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
            default: // Recently Published
                return sorted.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        }
    }

    // ─── Feed articles with load-more ────────────────
    const feedEl = document.getElementById('feed-articles');
    const loadBtn = document.querySelector('.load-btn');

    function getFiltered() {
        const base = activeCategory === 'All' ? articles : articles.filter(a => a.category === activeCategory);
        return sortArticles(base);
    }

    function renderCard(a) {
        return `<div class="article-container" data-category="${a.category || 'General'}">
            <a href="./pages/article.html?id=${a.id}" class="article-card">
                <div class="article-image" ${a.image ? `style="background-image:url('${a.image}');background-size:cover;background-position:center;"` : ''}></div>
                <div class="article-category">${a.category || 'General'}</div>
                <h3 class="article-title">${Utils.escapeHTML(a.title)}</h3>
                <p class="article-description">By ${authorName(a)}</p>
            </a>
        </div>`;
    }

    function renderFeed(reset) {
        if (reset) { feedPage = 0; feedEl.innerHTML = ''; }
        const filtered = getFiltered();
        const start = feedPage * PAGE_SIZE;
        const slice = filtered.slice(start, start + PAGE_SIZE);
        feedEl.innerHTML += slice.map(renderCard).join('');
        feedPage++;
        const totalShown = feedPage * PAGE_SIZE;
        if (loadBtn) loadBtn.style.display = totalShown >= filtered.length ? 'none' : '';
    }

    renderFeed(true);

    if (loadBtn) {
        loadBtn.addEventListener('click', () => renderFeed(false));
    }

    // ─── Category filter buttons ─────────────────────
    document.querySelector('.feed .category-buttons').addEventListener('click', (e) => {
        const btn = e.target.closest('.category-button');
        if (!btn) return;
        document.querySelectorAll('.feed .category-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.textContent.trim();
        renderFeed(true);
    });

    // ─── Dropdown: update text + sort ─────────────────
    const catDropdown = document.querySelector('.category-dropdown');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    if (catDropdown && dropdownMenu) {
        dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const oldLabel = activeSortLabel;
                const newLabel = item.textContent.trim();
                // Swap: put old label as an option, remove the selected one
                activeSortLabel = newLabel;
                // Update the button text (keep the caret)
                catDropdown.childNodes[0].textContent = newLabel + ' ';
                // Update the dropdown item to show the old label
                item.textContent = oldLabel;
                // Close dropdown
                catDropdown.classList.remove('active');
                renderFeed(true);
            });
        });
    }

    // ─── Newsletter subscribe ─────────────────────────
    const subBtn = document.querySelector('.newsletter-button');
    const subInput = document.querySelector('.newsletter-input');
    if (subBtn && subInput) {
        subBtn.addEventListener('click', () => {
            const email = subInput.value.trim();
            if (!email) {
                subInput.focus();
                subInput.style.outline = '2px solid #e53e3e';
                setTimeout(() => subInput.style.outline = '', 1500);
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                Utils.showToast('Please enter a valid email address.', 'error');
                subInput.focus();
                return;
            }
            // Store subscription in localStorage
            const subs = JSON.parse(localStorage.getItem('lb_newsletter') || '[]');
            if (subs.includes(email)) {
                Utils.showToast('You\'re already subscribed!', 'info');
            } else {
                subs.push(email);
                localStorage.setItem('lb_newsletter', JSON.stringify(subs));
                Utils.showToast('Welcome aboard! You\'re now subscribed.', 'success');
            }
            subInput.value = '';
        });

        subInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                subBtn.click();
            }
        });
    }
});

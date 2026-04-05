document.addEventListener('components-loaded', async () => {
    const articles = await DataService.getArticles();
    const grid = document.getElementById('articles-grid');

    function authorName(a) {
        if (!a.author) return 'LoopBridge Team';
        if (typeof a.author === 'string') return a.author;
        return a.author.name || 'LoopBridge Team';
    }

    function renderArticles(category) {
        const filtered = category === 'All topics' ? articles : articles.filter(a => a.category === category);
        if (grid) {
            grid.innerHTML = filtered.map(a => `
                <a href="./pages/article.html?id=${a.id}">
                    <div class="article-card">
                        <div class="article-image" ${a.image ? `style="background-image:url('${a.image}');background-size:cover;background-position:center;"` : ''}>
                            <div class="article-category">${a.category || 'General'}</div>
                        </div>
                        <div class="article-body">
                            <div class="main">
                                <h3 class="article-title">${Utils.escapeHTML(a.title)}</h3>
                                <p class="article-description">${Utils.escapeHTML(a.description || a.excerpt || '')}</p>
                            </div>
                            <p class="article-subscript">${a.readTime || '5 min read'}</p>
                        </div>
                    </div>
                </a>
            `).join('');
        }
    }

    renderArticles('All topics');

    document.querySelectorAll('.category-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderArticles(btn.textContent.trim());
        });
    });
});

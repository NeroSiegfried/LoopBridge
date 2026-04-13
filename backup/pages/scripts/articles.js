document.addEventListener('components-loaded', async () => {
    const grid = document.getElementById('articles-grid');
    const filterContainer = document.getElementById('category-filter');
    const searchInput = document.getElementById('article-search');
    const loadMoreBtn = document.getElementById('load-more-btn');

    let allArticles = [];
    let filteredArticles = [];
    let currentCategory = 'All';
    let searchQuery = '';
    const PAGE_SIZE = 9;
    let displayCount = PAGE_SIZE;

    // Show skeletons while loading
    Utils.showSkeletons(grid, 6, 'card');

    // Load articles
    allArticles = await DataService.getArticles();
    filteredArticles = [...allArticles];

    // Extract unique categories
    const categories = ['All', ...new Set(allArticles.map(a => a.category).filter(Boolean))];

    // Render category filter buttons
    filterContainer.innerHTML = categories.map(cat => `
        <button class="category-pill${cat === 'All' ? ' active' : ''}" data-category="${cat}">${cat}</button>
    `).join('');

    // Category click handler
    filterContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-pill');
        if (!btn) return;

        currentCategory = btn.dataset.category;
        filterContainer.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        displayCount = PAGE_SIZE;
        applyFilters();
    });

    // Search handler
    searchInput.addEventListener('input', Utils.debounce(() => {
        searchQuery = searchInput.value.trim().toLowerCase();
        displayCount = PAGE_SIZE;
        applyFilters();
    }, 250));

    // Load more handler
    loadMoreBtn.addEventListener('click', () => {
        displayCount += PAGE_SIZE;
        renderArticles();
    });

    function applyFilters() {
        filteredArticles = allArticles.filter(article => {
            const matchCategory = currentCategory === 'All' || article.category === currentCategory;
            const matchSearch = !searchQuery ||
                article.title.toLowerCase().includes(searchQuery) ||
                (article.excerpt && article.excerpt.toLowerCase().includes(searchQuery)) ||
                (article.category && article.category.toLowerCase().includes(searchQuery));
            return matchCategory && matchSearch;
        });
        renderArticles();
    }

    function renderArticles() {
        const toShow = filteredArticles.slice(0, displayCount);
        const showAdmin = Auth.isLoggedIn() && (Auth.isAdmin() || Auth.isAuthor());

        ArticleCard.renderGrid(grid, toShow, {
            basePath: '../',
            showAdmin: showAdmin
        });

        // Show/hide load more
        loadMoreBtn.style.display = displayCount < filteredArticles.length ? 'inline-flex' : 'none';

        // Attach admin event handlers
        if (showAdmin) {
            grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = '../admin/edit-article.html?id=' + btn.dataset.id;
                });
            });

            grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const confirmed = await Utils.confirm('Are you sure you want to delete this article? This cannot be undone.', 'Delete Article');
                    if (confirmed) {
                        try {
                            await DataService.deleteArticle(btn.dataset.id);
                            allArticles = allArticles.filter(a => a.id !== btn.dataset.id);
                            Utils.showToast('Article deleted successfully.', 'success');
                            applyFilters();
                        } catch (err) {
                            Utils.showToast('Failed to delete article.', 'error');
                        }
                    }
                });
            });
        }
    }

    // Initial render
    applyFilters();
});

document.addEventListener('components-loaded', async () => {
    const res = await fetch('./data/faqs.json');
    const faqData = await res.json();
    const faqList = document.getElementById('faq-list');
    const buttons = document.querySelectorAll('.category-button');

    function renderFaqs(category) {
        const items = faqData[category] || [];
        if (!faqList) return;
        faqList.innerHTML = items.map(faq => `
            <div class="QnA-item">
                <h3 class="question"><span class="text">${Utils.escapeHTML(faq.question)}</span><span class="button"><i class="fa-solid fa-plus"></i></span></h3>
                <p class="answer">${Utils.escapeHTML(faq.answer)}</p>
            </div>
        `).join('');

        // Re-bind accordion behavior
        faqList.querySelectorAll('.QnA-item').forEach(item => {
            const question = item.querySelector('.question');
            const icon = question.querySelector('.button i');
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                faqList.querySelectorAll('.QnA-item').forEach(i => {
                    i.classList.remove('active');
                    const otherIcon = i.querySelector('.button i');
                    otherIcon.classList.remove('fa-minus');
                    otherIcon.classList.add('fa-plus');
                });
                if (!isActive) {
                    item.classList.add('active');
                    icon.classList.remove('fa-plus');
                    icon.classList.add('fa-minus');
                }
            });
        });
    }

    // Initial render
    renderFaqs('General');

    // Category switching
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderFaqs(btn.textContent.trim());
        });
    });
});

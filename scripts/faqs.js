document.addEventListener("DOMContentLoaded", () => {
    const qnaItems = document.querySelectorAll(".QnA-item");

    qnaItems.forEach((item) => {
        const question = item.querySelector(".question");
        const icon = question.querySelector(".button i");

        question.addEventListener("click", () => {
            const isActive = item.classList.contains("active");

            // Close all open items and reset their icons
            qnaItems.forEach((i) => {
                i.classList.remove("active");
                const otherIcon = i.querySelector(".button i");
                otherIcon.classList.remove("fa-minus");
                otherIcon.classList.add("fa-plus");
            });

            // If it wasn't already open, open it and swap icon
            if (!isActive) {
                item.classList.add("active");
                icon.classList.remove("fa-plus");
                icon.classList.add("fa-minus");
            }
        });
    });
});

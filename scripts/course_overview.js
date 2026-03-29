document.addEventListener("DOMContentLoaded", () => {
    const topics = document.querySelectorAll(".topic");

    topics.forEach((topic) => {
        const bar = topic.querySelector(".topic-bar");

        bar.addEventListener("click", () => {
            const isActive = topic.classList.contains("active");

            // Close all open topics
            topics.forEach((t) => t.classList.remove("active"));

            // If it wasn't already open, open it
            if (!isActive) {
                topic.classList.add("active");
            }
        });

        // Accessibility
        bar.setAttribute("role", "button");
        bar.setAttribute("tabindex", "0");
        bar.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                bar.click();
            }
        });
    });
});
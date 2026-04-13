document.addEventListener("DOMContentLoaded", () => {
    const searchDiv = document.querySelector(".search");
    if (!searchDiv) return;
    const searchInput = searchDiv.querySelector("input");

    searchDiv.addEventListener("click", () => {
        if (searchInput) searchInput.focus();
    });
});
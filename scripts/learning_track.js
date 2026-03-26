document.addEventListener("DOMContentLoaded", () => {
    const searchDiv = document.querySelector(".search");
    const searchInput = searchDiv.querySelector("input");

    searchDiv.addEventListener("click", () => {
        searchInput.focus(); // Focus the input when the search div is clicked
    });
});
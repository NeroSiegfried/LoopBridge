document.addEventListener("DOMContentLoaded", () => {
    const dropdown = document.querySelector(".category-dropdown");
    const dropdownMenu = document.querySelector(".dropdown-menu");

    // Toggle dropdown menu visibility
    dropdown.addEventListener("click", () => {
        dropdown.classList.toggle("active"); // Add or remove the 'active' class
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });
});
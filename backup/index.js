document.addEventListener("DOMContentLoaded", () => {
    const circleEffect = document.querySelector(".circle-effect");

    // List of base colors from the image
    const baseColors = [
        "#79EC94", "#79ECA9", "#79ECAB", "#7996EC", "#799CEC", "#79D3EC", "#79EC87", "#79ECAF",
        "#79ECB2", "#79ECB8", "#79ECD7", "#79A5EC", "#79A9EC", "#79ABEC", "#79B4EC", "#79B8EC",
        "#79BAEC", "#79BEEC", "#79CDEC", "#79D7EC", "#79DEEC", "#79E8EC", "#79EC83", "#79EC8C",
        "#79EC9C", "#79ECA5", "#79ECB6", "#79ECBC", "#79ECBE", "#79ECC4", "#79ECD5", "#79ECDB",
        "#7FEC79"
    ];

    // Function to generate a random color within the range of provided colors
    function getRandomColor() {
        const baseColor = baseColors[Math.floor(Math.random() * baseColors.length)];
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        // Slightly adjust the RGB values randomly within a range
        const randomR = Math.min(255, Math.max(0, r + Math.floor(Math.random() * 30 - 15)));
        const randomG = Math.min(255, Math.max(0, g + Math.floor(Math.random() * 30 - 15)));
        const randomB = Math.min(255, Math.max(0, b + Math.floor(Math.random() * 30 - 15)));

        return `rgb(${randomR}, ${randomG}, ${randomB})`;
    }

    // Function to create and animate a circle
    function createCircle() {
    const circle = document.createElement("div");
    circle.classList.add("circle");

    // Random size between 10px and 25px
    const size = Math.floor(Math.random() * (25 - 10 + 1)) + 10;
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;

    // Random initial position
    const posX = Math.random() * 100; // Percentage for left position
    const posY = Math.random() * 100; // Percentage for top position
    circle.style.left = `${posX}%`;
    circle.style.top = `${posY}%`;

    // Random color
    circle.style.backgroundColor = getRandomColor();

    // Random animation duration
    const duration = Math.random() * 5 + 5; // Between 5s and 10s
    circle.style.animationDuration = `${duration}s`;

    // Random movement direction
    const translateX = Math.random() * 100 - 50; // Random horizontal movement (-50px to 50px)
    const translateY = Math.random() * 100 - 50; // Random vertical movement (-50px to 50px)
    circle.style.setProperty("--translateX", `${translateX}px`);
    circle.style.setProperty("--translateY", `${translateY}px`);

    // Append the circle to the circle-effect div
    circleEffect.appendChild(circle);

    // Remove the circle after its animation ends and create a new one
    setTimeout(() => {
        circle.remove();
        createCircle();
    }, duration * 1000);
}

    // Generate 40 circles
    for (let i = 0; i < 40; i++) {
        createCircle();
    }
});
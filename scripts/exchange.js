document.addEventListener("DOMContentLoaded", () => {
    const marqueeContent = document.querySelector(".marquee-content");
    const marquee = document.querySelector(".marquee");

    // Clone the marquee content
    const clone = marqueeContent.cloneNode(true);
    marquee.appendChild(clone);

    // Set the width of the marquee content to ensure proper alignment
    const contentWidth = marqueeContent.scrollWidth;
    marqueeContent.style.width = `${contentWidth}px`;
    clone.style.width = `${contentWidth}px`;

    // Set the animation duration based on the content width and a constant speed
    const scrollSpeed = 100; // pixels per second
    const duration = contentWidth / scrollSpeed;

    // Apply the animation duration to both the original and cloned content
    marqueeContent.style.animationDuration = `${duration}s`;
    clone.style.animationDuration = `${duration}s`;
});
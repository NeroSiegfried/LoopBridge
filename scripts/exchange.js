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

document.addEventListener("DOMContentLoaded", () => {

    // ============================================================
    //  STEP CAROUSEL
    // ============================================================

    const steps = document.querySelectorAll(".exchange-pathways .step");
    const slides = document.querySelectorAll(".slide-counter .slide");
    const gif = document.querySelector(".section-body .gif");

    const STEP_DURATIONS = [6000, 4000, 14000, null]; // null = gif duration

    let currentStep = 0;
    let timer = null;

    // Get GIF duration dynamically if a gif element exists.
    // When the real GIF is added, replace this function's body with
    // actual GIF duration detection (e.g. via a library or data attribute).
    function getGifDuration() {
        if (gif && gif.dataset.duration) {
            return parseFloat(gif.dataset.duration) * 1000; // data-duration="30" in seconds
        }
        return 30000; // fallback: 30s
    }

    function getDuration(index) {
        return STEP_DURATIONS[index] ?? getGifDuration();
    }

    function goToStep(index) {
        // Remove active from all steps and slides
        steps.forEach((step) => step.classList.remove("active"));
        slides.forEach((slide) => slide.classList.remove("active"));

        // Set active on the new step and slide
        steps[index].classList.add("active");
        if (slides[index]) slides[index].classList.add("active");

        currentStep = index;

        // Clear any existing timer and schedule the next step
        clearTimeout(timer);
        const duration = getDuration(index);
        const nextIndex = (index + 1) % steps.length;
        timer = setTimeout(() => goToStep(nextIndex), duration);
    }

    // Kick off from step 0
    goToStep(0);

});
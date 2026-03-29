/**
 * Footer Component JS
 * Updates the copyright year dynamically.
 */
(function () {
    'use strict';

    const yearSpan = document.querySelector('footer .year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
})();

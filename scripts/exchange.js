document.addEventListener("DOMContentLoaded", async () => {
    const marqueeContent = document.getElementById("marquee-content");
    const marquee = document.querySelector(".marquee");

    // ─── Fetch live prices from CoinGecko ───────────────────
    const COINS = 'bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,tron';
    const SYMBOL_MAP = {
        bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
        ripple: 'XRP', cardano: 'ADA', dogecoin: 'DOGE', tron: 'TRX'
    };

    let coins = [];
    try {
        const res = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
        );
        if (res.ok) coins = await res.json();
    } catch (err) {
        console.warn('[Exchange] CoinGecko API unavailable, using fallback data.', err);
    }

    // Fallback data in case API fails
    if (!coins.length) {
        coins = [
            { id: 'bitcoin', name: 'Bitcoin', image: '', current_price: 87432.10, price_change_percentage_24h: 1.24 },
            { id: 'ethereum', name: 'Ethereum', image: '', current_price: 2015.50, price_change_percentage_24h: -0.85 },
            { id: 'solana', name: 'Solana', image: '', current_price: 138.20, price_change_percentage_24h: 3.42 },
            { id: 'binancecoin', name: 'BNB', image: '', current_price: 612.30, price_change_percentage_24h: 0.52 },
            { id: 'ripple', name: 'XRP', image: '', current_price: 2.41, price_change_percentage_24h: -1.10 },
            { id: 'cardano', name: 'Cardano', image: '', current_price: 0.72, price_change_percentage_24h: 2.30 },
            { id: 'dogecoin', name: 'Dogecoin', image: '', current_price: 0.17, price_change_percentage_24h: -0.33 },
            { id: 'tron', name: 'TRON', image: '', current_price: 0.23, price_change_percentage_24h: 0.92 }
        ];
    }

    function formatPrice(price) {
        if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return '$' + price.toFixed(4);
    }

    function renderCurrency(coin) {
        const change = coin.price_change_percentage_24h || 0;
        const sign = change >= 0 ? '+' : '';
        const colorClass = change >= 0 ? 'positive' : 'negative';
        const symbol = SYMBOL_MAP[coin.id] || coin.symbol?.toUpperCase() || '';
        const icon = coin.image
            ? `<img src="${coin.image}" alt="${coin.name}" style="width:40px;height:40px;border-radius:50%;">`
            : `<span style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#e9fded;border-radius:50%;font-weight:600;font-size:14px;">${symbol.slice(0,2)}</span>`;

        return `<div class="currency">
            <div class="left">
                <div class="icon">${icon}</div>
                <div class="name">
                    <div class="full">${coin.name}</div>
                    <div class="short">${symbol}</div>
                </div>
            </div>
            <div class="numbers">
                <div class="value">${formatPrice(coin.current_price)}</div>
                <div class="change ${colorClass}">${sign}${change.toFixed(2)}%</div>
            </div>
        </div>`;
    }

    // Build marquee content
    marqueeContent.innerHTML = coins.map(renderCurrency).join('');

    // Clone for seamless loop
    const clone = marqueeContent.cloneNode(true);
    marquee.appendChild(clone);

    // Set animation speed
    const contentWidth = marqueeContent.scrollWidth;
    marqueeContent.style.width = `${contentWidth}px`;
    clone.style.width = `${contentWidth}px`;

    const scrollSpeed = 100;
    const duration = contentWidth / scrollSpeed;
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

    const TOTAL_STEP_DURATION = STEP_DURATIONS.slice(0, -1).reduce((sum, d) => sum + d, 0);
    function getDuration(index) {
        return STEP_DURATIONS[index] ?? getGifDuration() - TOTAL_STEP_DURATION
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
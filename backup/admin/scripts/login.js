// If already logged in, redirect
if (Auth.isLoggedIn()) {
    window.location.href = 'dashboard.html';
}

const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('visible');
    loginBtn.textContent = 'Signing in...';
    loginBtn.disabled = true;

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    const user = await Auth.login(username, password);

    if (user) {
        // Redirect to return URL or dashboard
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get('return') || 'dashboard.html';
        window.location.href = returnUrl;
    } else {
        errorEl.classList.add('visible');
        loginBtn.textContent = 'Sign In';
        loginBtn.disabled = false;
    }
});

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import SEO from '../components/SEO';
import FloatingCircles from '../components/FloatingCircles';
import '../styles/login.css';

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(null);

  // Fetch Google Client ID from server
  useEffect(() => {
    authApi.getGoogleClientId()
      .then((data) => { if (data.clientId) setGoogleClientId(data.clientId); })
      .catch(() => {});
  }, []);

  // Google Sign-In callback
  const handleGoogleResponse = useCallback(async (response) => {
    setError('');
    setLoading(true);
    try {
      await googleLogin(response.credential);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }, [googleLogin, navigate]);

  // Load Google Sign-In script when clientId is available
  useEffect(() => {
    if (!googleClientId) return;

    // Don't load if already loaded
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleResponse
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: '100%', text: 'continue_with' }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleResponse
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', width: '100%', text: 'continue_with' }
      );
    };
    document.head.appendChild(script);

    return () => {
      // cleanup if needed
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [googleClientId, handleGoogleResponse]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO title="Sign In — LoopBridge" description="Sign in to your LoopBridge account." />
      <div className="login-page">
        <FloatingCircles />
        <div className="login-brand">
          <div className="brand-logo">
            <Link to="/">
              <img src="/images/logos/LB text no symbol black 2.png" alt="LoopBridge" />
            </Link>
          </div>
          <h2>Your Companion Through Every Stage of <span>New Finance</span></h2>
          <p>Learn, trade, and grow — all inside one community built for the Web3 era.</p>
          <div className="brand-features">
            <div className="brand-feature">
              <i className="fa-solid fa-graduation-cap" />
              Structured courses from beginner to advanced
            </div>
            <div className="brand-feature">
              <i className="fa-solid fa-comments" />
              Trade crypto directly on WhatsApp
            </div>
            <div className="brand-feature">
              <i className="fa-solid fa-users" />
              A growing community of learners and traders
            </div>
            <div className="brand-feature">
              <i className="fa-solid fa-pen-to-square" />
              Create and share your own articles
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-card">
            <h1>Welcome back</h1>
            <p className="subtitle">Sign in to your LoopBridge account</p>

            {error && <div className="login-error visible">{error}</div>}

            <form id="login-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="username">Username</label>
                <input
                  className="input"
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  className="input"
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            {/* ─── Google SSO ─── */}
            {googleClientId && (
              <div className="social-login">
                <div className="divider"><span>or</span></div>
                <div id="google-signin-btn" className="google-btn-wrapper" />
              </div>
            )}

            {/* ─── Phone Signup ─── */}
            <div className="social-login">
              {!googleClientId && <div className="divider"><span>or</span></div>}
              <Link to="/signup" className="btn-phone-signup">
                <i className="fa-solid fa-mobile-screen-button" />
                Sign up with phone number
              </Link>
            </div>

            <div className="login-hint">
              <strong>Demo Accounts:</strong><br />
              Admin: <code>admin</code> / <code>admin123</code><br />
              Author: <code>ngozi</code> / <code>author123</code><br />
              User: <code>demo</code> / <code>demo123</code>
            </div>

            <div className="form-footer">
              <Link to="/">← Back to Home</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

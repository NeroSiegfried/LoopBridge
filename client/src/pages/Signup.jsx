import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import SEO from '../components/SEO';
import FloatingCircles from '../components/FloatingCircles';
import '../styles/login.css';
import '../styles/signup.css';

const STEPS = { PHONE: 'phone', VERIFY: 'verify', PROFILE: 'profile' };

export default function Signup() {
  const { otpLogin } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [channel, setChannel] = useState('email'); // 'email' | 'whatsapp'
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    setLoading(true);
    try {
      const result = await authApi.sendOtp(phone.trim(), channel);
      setOtpSent(true);
      if (result.code) setDevCode(result.code); // dev mode only
      setStep(STEPS.VERIFY);
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendBothChannels = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone.trim()) { setError('Please enter your phone number.'); return; }
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      // Send OTP to both channels
      const emailResult = await authApi.sendOtp(phone.trim(), 'email');
      await authApi.sendOtp(phone.trim(), 'whatsapp');
      setOtpSent(true);
      if (emailResult.code) setDevCode(emailResult.code);
      setStep(STEPS.VERIFY);
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpCode.trim()) { setError('Please enter the OTP code.'); return; }
    setLoading(true);
    try {
      await otpLogin({
        phone: phone.trim(),
        code: otpCode.trim(),
        channel,
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await authApi.sendOtp(phone.trim(), channel);
      if (result.code) setDevCode(result.code);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO title="Sign Up — LoopBridge" description="Create your LoopBridge account with phone verification." />
      <div className="login-page">
        <FloatingCircles />
        <div className="login-brand">
          <div className="brand-logo">
            <Link to="/">
              <img src="/images/logos/LB text no symbol black 2.png" alt="LoopBridge" />
            </Link>
          </div>
          <h2>Join the <span>LoopBridge</span> Community</h2>
          <p>Create your account in seconds with just your phone number.</p>
          <div className="brand-features">
            <div className="brand-feature">
              <i className="fa-solid fa-shield-check" />
              Verified via email &amp; WhatsApp OTP
            </div>
            <div className="brand-feature">
              <i className="fa-solid fa-bolt" />
              Quick signup — no long forms
            </div>
            <div className="brand-feature">
              <i className="fa-solid fa-graduation-cap" />
              Instant access to all free courses
            </div>
            <div className="brand-feature">
              <i className="fa-solid fa-users" />
              Join a growing community of learners
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-card signup-card">
            {step === STEPS.PHONE && (
              <>
                <h1>Create your account</h1>
                <p className="subtitle">We'll send a verification code to your email and WhatsApp</p>

                {error && <div className="login-error visible">{error}</div>}

                <form onSubmit={handleSendBothChannels}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-name">Display Name</label>
                    <input
                      className="input"
                      type="text"
                      id="signup-name"
                      placeholder="What should we call you?"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-phone">Phone Number</label>
                    <input
                      className="input"
                      type="tel"
                      id="signup-phone"
                      placeholder="+234 800 000 0000"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-email">Email Address</label>
                    <input
                      className="input"
                      type="email"
                      id="signup-email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="otp-channels">
                    <p className="channel-info">
                      <i className="fa-solid fa-circle-info" />
                      A 6-digit code will be sent to <strong>both</strong> your email and WhatsApp.
                      You can verify using either one.
                    </p>
                  </div>

                  <button type="submit" className="btn-login" disabled={loading}>
                    {loading ? 'Sending code…' : 'Send Verification Code'}
                  </button>
                </form>

                <div className="form-footer">
                  <Link to="/login">Already have an account? Sign in</Link>
                </div>
              </>
            )}

            {step === STEPS.VERIFY && (
              <>
                <h1>Verify your number</h1>
                <p className="subtitle">
                  Enter the 6-digit code sent to your email and WhatsApp for <strong>{phone}</strong>
                </p>

                {error && <div className="login-error visible">{error}</div>}

                {devCode && (
                  <div className="login-hint">
                    <strong>Dev Mode:</strong> OTP code is <code>{devCode}</code>
                  </div>
                )}

                <form onSubmit={handleVerifyOtp}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="otp-code">Verification Code</label>
                    <input
                      className="input otp-input"
                      type="text"
                      id="otp-code"
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoComplete="one-time-code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </div>

                  <div className="otp-channel-select">
                    <label className="form-label">Verify using code from:</label>
                    <div className="channel-toggle">
                      <button
                        type="button"
                        className={`channel-btn${channel === 'email' ? ' active' : ''}`}
                        onClick={() => setChannel('email')}
                      >
                        <i className="fa-solid fa-envelope" /> Email
                      </button>
                      <button
                        type="button"
                        className={`channel-btn${channel === 'whatsapp' ? ' active' : ''}`}
                        onClick={() => setChannel('whatsapp')}
                      >
                        <i className="fa-brands fa-whatsapp" /> WhatsApp
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="btn-login" disabled={loading}>
                    {loading ? 'Verifying…' : 'Verify & Create Account'}
                  </button>
                </form>

                <div className="resend-section">
                  <button className="resend-btn" onClick={handleResend} disabled={loading}>
                    Resend code
                  </button>
                  <span className="separator">·</span>
                  <button className="resend-btn" onClick={() => { setStep(STEPS.PHONE); setOtpSent(false); setError(''); }}>
                    Change number
                  </button>
                </div>

                <div className="form-footer">
                  <Link to="/login">Back to Sign In</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

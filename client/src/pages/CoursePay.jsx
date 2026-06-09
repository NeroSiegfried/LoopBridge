import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { coursesApi, paymentsApi } from '../api';
import SEO from '../components/SEO';
import '../styles/payment.css';

const PROVIDERS = [
  {
    id: 'paystack',
    label: 'Paystack',
    tagline: 'Nigerian cards, bank transfer, USSD',
    emoji: '🏦',
    colorClass: 'paystack',
  },
  {
    id: 'flutterwave',
    label: 'Flutterwave',
    tagline: 'NGN + international cards, mobile money',
    emoji: '🌍',
    colorClass: 'flutterwave',
  },
  {
    id: 'nowpayments',
    label: 'Crypto',
    tagline: 'Pay with BTC, ETH, USDT, USDC, SOL, BNB…',
    emoji: '₿',
    colorClass: 'crypto',
  },
];

export default function CoursePay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [provider, setProvider] = useState('paystack');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true, state: { from: `/courses/${id}/pay` } });
    }
  }, [authLoading, user, id, navigate]);

  useEffect(() => {
    setCourseLoading(true);
    coursesApi.get(id)
      .then(setCourse)
      .catch(() => navigate('/courses', { replace: true }))
      .finally(() => setCourseLoading(false));
  }, [id]); // eslint-disable-line

  // If user already has access, send them straight to the course
  useEffect(() => {
    if (!course || !user) return;
    if (!course.price || course.price === 0) {
      navigate(`/courses/${id}`, { replace: true });
      return;
    }
    coursesApi.checkAccess(id)
      .then(({ canAccess }) => {
        if (canAccess) navigate(`/courses/${id}/lessons/0/0`, { replace: true });
      })
      .catch(() => {});
  }, [course, user]); // eslint-disable-line

  const handlePay = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await paymentsApi.initiate({
        provider,
        courseId: id,
        currency: provider === 'nowpayments' ? 'USD' : 'NGN',
      });
      // Redirect to provider's hosted checkout page
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err.message || 'Payment could not be initiated. Please try again.');
      setSubmitting(false);
    }
  };

  if (authLoading || courseLoading) {
    return (
      <div className="pay-page">
        <div className="pay-card">
          <div className="pay-header">
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const price = course.price || 0;
  const currency = 'NGN';

  return (
    <>
      <SEO
        title={`Enroll in ${course.title} — LoopBridge`}
        description={`Get full access to ${course.title} on LoopBridge Academy.`}
      />

      <div className="pay-page">
        <div className="pay-card">

          {/* ─── Header ─── */}
          <div className="pay-header">
            <Link to={`/courses/${id}`} className="back-link">
              <i className="fa-solid fa-angle-left" /> Back to course
            </Link>
            <h1>{course.title}</h1>
            <p className="course-subtitle">Full lifetime access · All lessons &amp; resources</p>
            <div className="pay-price-badge">
              ₦{price.toLocaleString()} {currency}
            </div>
          </div>

          {/* ─── Body ─── */}
          <div className="pay-body">
            <h2>Choose payment method</h2>

            <div className="pay-providers">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={`pay-provider-card${provider === p.id ? ' selected' : ''}`}
                  onClick={() => setProvider(p.id)}
                  type="button"
                >
                  <div className={`pay-provider-icon ${p.colorClass}`}>{p.emoji}</div>
                  <div className="pay-provider-info">
                    <strong>{p.label}</strong>
                    <span>{p.tagline}</span>
                  </div>
                  <div className="pay-provider-check">
                    {provider === p.id && <i className="fa-solid fa-check" />}
                  </div>
                </button>
              ))}
            </div>

            {provider === 'nowpayments' && (
              <div className="pay-crypto-note">
                <strong>Pay with cryptocurrency.</strong> You'll be redirected to NOWPayments to
                complete your payment. Price is shown in USD equivalent.
                <div className="pay-crypto-coins">
                  {['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'MATIC', 'TRX'].map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="pay-error">{error}</div>}

            <button
              className="pay-submit-btn"
              onClick={handlePay}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="pay-spinner" />
                  Redirecting…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-lock" />
                  Pay {provider === 'nowpayments' ? '(crypto)' : `₦${price.toLocaleString()}`} securely
                </>
              )}
            </button>

            <p className="pay-secure-note">
              <i className="fa-solid fa-shield-halved" />
              Payments are processed securely by {
                provider === 'paystack' ? 'Paystack' :
                provider === 'flutterwave' ? 'Flutterwave' : 'NOWPayments'
              }. LoopBridge does not store your card details.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

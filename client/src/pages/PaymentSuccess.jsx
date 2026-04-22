import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { paymentsApi } from '../api';
import SEO from '../components/SEO';
import '../styles/payment.css';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const courseId   = searchParams.get('courseId');

  const [status, setStatus] = useState('verifying'); // verifying | success | failed
  const [error, setError]   = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    if (!reference) { setStatus('failed'); setError('No payment reference found.'); return; }

    paymentsApi.verify(reference)
      .then(() => setStatus('success'))
      .catch((err) => {
        // 402 = payment not yet confirmed (e.g. crypto still pending)
        if (err.status === 402) {
          setStatus('pending');
        } else {
          setStatus('failed');
          setError(err.message || 'Could not verify payment.');
        }
      });
  }, [authLoading, user]); // eslint-disable-line

  const courseHref = courseId ? `/courses/${courseId}/lessons/0/0` : '/courses';
  const overviewHref = courseId ? `/courses/${courseId}` : '/courses';

  return (
    <>
      <SEO title="Payment — LoopBridge" />
      <div className="payment-result-page">
        <div className="payment-result-card">

          {status === 'verifying' && (
            <>
              <span className="payment-result-icon">⏳</span>
              <h1>Verifying payment…</h1>
              <div className="payment-verifying">
                <span className="pay-spinner dark" /> Checking with payment provider
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <span className="payment-result-icon">🎉</span>
              <h1>You're enrolled!</h1>
              <p>Payment confirmed. You now have full access to this course. Let's get started!</p>
              <div className="payment-result-actions">
                <Link to={courseHref} className="btn-primary">Start learning →</Link>
                <Link to="/courses" className="btn-ghost">Browse more courses</Link>
              </div>
            </>
          )}

          {status === 'pending' && (
            <>
              <span className="payment-result-icon">🕐</span>
              <h1>Payment pending</h1>
              <p>
                Your crypto payment has been received and is being confirmed on-chain.
                This can take a few minutes. You'll gain access automatically once confirmed —
                no need to do anything else.
              </p>
              <div className="payment-result-actions">
                <Link to={overviewHref} className="btn-primary">Back to course</Link>
                <Link to="/" className="btn-ghost">Go to home</Link>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <span className="payment-result-icon">❌</span>
              <h1>Payment failed</h1>
              <p>{error || 'Something went wrong verifying your payment. If you were charged, please contact support.'}</p>
              <div className="payment-result-actions">
                {courseId && (
                  <Link to={`/courses/${courseId}/pay`} className="btn-primary">Try again</Link>
                )}
                <Link to="/courses" className="btn-ghost">Browse courses</Link>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}

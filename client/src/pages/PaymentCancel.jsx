import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import '../styles/payment.css';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');

  return (
    <>
      <SEO title="Payment Cancelled — LoopBridge" />
      <div className="payment-result-page">
        <div className="payment-result-card">
          <span className="payment-result-icon">↩️</span>
          <h1>Payment cancelled</h1>
          <p>No charge was made. You can try again whenever you're ready.</p>
          <div className="payment-result-actions">
            {courseId ? (
              <Link to={`/courses/${courseId}/pay`} className="btn-primary">Try again</Link>
            ) : (
              <Link to="/courses" className="btn-primary">Browse courses</Link>
            )}
            <Link to="/" className="btn-ghost">Go to home</Link>
          </div>
        </div>
      </div>
    </>
  );
}

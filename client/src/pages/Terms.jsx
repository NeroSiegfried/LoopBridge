import SEO from '../components/SEO';
import '../styles/legal.css';

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Service — LoopBridge"
        description="Read the terms and conditions governing your use of the LoopBridge platform."
      />
      <section className="legal-hero">
        <div className="banner">
          <div className="left vector"><img src="/images/left-vector.svg" alt="Vector Pattern" /></div>
          <div className="body">
            <h1>Terms of Service</h1>
          </div>
          <div className="right vector"><img src="/images/right-vector.svg" alt="Vector Pattern" /></div>
        </div>
      </section>
      <section className="legal-body">
        <div className="section-container">
          <ol>
            <h2><li>Introduction &amp; Acceptance</li></h2>
            <p>By accessing LoopBridge services, you agree to these terms. Please read them carefully before using any part of the platform.</p>

            <h2><li>Eligibility</li></h2>
            <p>You must be at least 18 years old and comply with your country's local crypto regulations.</p>

            <h2><li>Services Covered</li></h2>
            <ul>
              <li><p>LoopBridge Academy (educational content).</p></li>
              <li><p>LoopBridge Exchange (WhatsApp &amp; Telegram-based trades).</p></li>
              <li><p>LoopBridge Community (forums, social channels).</p></li>
            </ul>

            <h2><li>User Responsibilities</li></h2>
            <ul>
              <li><p>Keep login credentials private.</p></li>
              <li><p>Verify rates before confirming a trade.</p></li>
              <li><p>Use official LoopBridge channels only.</p></li>
            </ul>

            <h2><li>Prohibited Use</li></h2>
            <p>No unlawful, fraudulent, or money-laundering activities.</p>

            <h2><li>Disclaimer of Liability</li></h2>
            <p>We provide information and trading access, not financial advice. Users are responsible for their own trading decisions.</p>

            <h2><li>Termination Clause</li></h2>
            <p>LoopBridge may suspend or terminate access to maintain platform integrity or comply with law.</p>

            <h2><li>Governing Law</li></h2>
            <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
          </ol>
        </div>
      </section>
    </>
  );
}

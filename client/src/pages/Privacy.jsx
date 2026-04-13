import SEO from '../components/SEO';
import '../styles/legal.css';

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy — LoopBridge"
        description="Learn how LoopBridge collects, uses, and protects your personal information."
      />
      <section className="legal-hero">
        <div className="banner">
          <div className="left vector"><img src="/images/left-vector.svg" alt="Vector Pattern" /></div>
          <div className="body">
            <h1>Privacy Policy</h1>
          </div>
          <div className="right vector"><img src="/images/right-vector.svg" alt="Vector Pattern" /></div>
        </div>
      </section>
      <section className="legal-body">
        <div className="section-container">
          <ol>
            <h2><li>Introduction</li></h2>
            <p>LoopBridge respects your privacy. We collect only what's necessary to operate our platform safely and efficiently.</p>

            <h2><li>Information We Collect</li></h2>
            <ul>
              <li><p>Basic contact info (name, email, phone).</p></li>
              <li><p>Transaction-related details (wallet address, trade confirmations).</p></li>
              <li><p>Device and usage data for analytics.</p></li>
            </ul>

            <h2><li>How We Use Your Data</li></h2>
            <ul>
              <li><p>To process trades and provide updates.</p></li>
              <li><p>To improve user experience and security.</p></li>
              <li><p>To send educational or service-related communications.</p></li>
            </ul>

            <h2><li>What We Won't Do</li></h2>
            <p>We never sell, rent, or share your data with advertisers or unverified third parties.</p>

            <h2><li>Your Rights</li></h2>
            <p>Users can request access, correction, or deletion of their data at any time by emailing <a href="mailto:privacy@loopbridge.com">privacy@loopbridge.com</a>.</p>

            <h2><li>Security</li></h2>
            <p>All information is encrypted in transit and at rest. Verified security audits are performed regularly. We respect your privacy. LoopBridge never sells your data.</p>
          </ol>
        </div>
      </section>
    </>
  );
}

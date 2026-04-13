import SEO from '../components/SEO';
import '../styles/legal.css';

export default function Disclaimer() {
  return (
    <>
      <SEO
        title="Risk Disclaimer — LoopBridge"
        description="Important disclaimers about the use of LoopBridge's educational and exchange services."
      />
      <section className="legal-hero">
        <div className="banner">
          <div className="left vector"><img src="/images/left-vector.svg" alt="Vector Pattern" /></div>
          <div className="body">
            <h1>Risk Disclaimer</h1>
          </div>
          <div className="right vector"><img src="/images/right-vector.svg" alt="Vector Pattern" /></div>
        </div>
      </section>
      <section className="legal-body">
        <div className="section-container">
          <h2>Introduction</h2>
          <p>Trading digital assets involves significant risk and may result in partial or total loss of capital. Prices can be highly volatile and affected by market, technical, and regulatory factors.</p>
          <p>LoopBridge provides tools and information to help you trade responsibly but does not guarantee profits or outcomes. All users should do their own research (DYOR), verify details before confirming transactions, and never share private keys with anyone — including LoopBridge representatives.</p>
          <p>By using LoopBridge Exchange, Academy, or Community, you acknowledge and accept these risks.</p>
        </div>
      </section>
    </>
  );
}

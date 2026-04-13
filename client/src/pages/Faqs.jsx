import { useState, useEffect } from 'react';
import SEO from '../components/SEO';
import { miscApi } from '../api';
import '../styles/faqs.css';

const CATEGORIES = ['General', 'Trading', 'Academy', 'Community', 'Security & Trust', 'Support & Contact', 'Risk & Responsibility'];

export default function Faqs() {
  const [faqData, setFaqData] = useState({});
  const [category, setCategory] = useState('General');
  const [activeItem, setActiveItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    miscApi.faqs()
      .then((data) => setFaqData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const faqs = faqData[category] || [];

  const handleToggle = (idx) => {
    setActiveItem(activeItem === idx ? null : idx);
  };

  return (
    <>
      <SEO
        title="FAQs — LoopBridge"
        description="Frequently asked questions about LoopBridge, crypto, blockchain, and our platform."
      />

      <header className="faq-hero">
        <div className="section-container">
          <div className="faqs-inner-section">
            <h1>Got Questions? You're in the Right Loop.</h1>
            <p>Here's everything you need to know about learning, trading, and growing inside LoopBridge.
move confidently through the new landscape of Web3.</p>
          </div>
        </div>
      </header>

      <section className="faq-section">
        <div className="section-container">
          <div className="categories">
            <div className="category-buttons">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`category-button${category === cat ? ' active' : ''}`}
                  onClick={() => { setCategory(cat); setActiveItem(null); }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="QnA" id="faq-list">
              {loading ? (
                <p>Loading…</p>
              ) : faqs.length === 0 ? (
                <p>No FAQs found for this category.</p>
              ) : (
                faqs.map((faq, idx) => (
                  <div
                    key={faq.id || idx}
                    className={`QnA-item${activeItem === idx ? ' active' : ''}`}
                  >
                    <h3 className="question" onClick={() => handleToggle(idx)}>
                      <span className="text">{faq.question}</span>
                      <span className="button">
                        <i className={`fa-solid ${activeItem === idx ? 'fa-minus' : 'fa-plus'}`} />
                      </span>
                    </h3>
                    <p className="answer">{faq.answer}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

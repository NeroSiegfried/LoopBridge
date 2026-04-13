import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { miscApi } from '../api';
import '../styles/footer.css';

const SOCIAL_ICONS = [
  { key: 'telegram', icon: 'fa-brands fa-telegram', label: 'Telegram' },
  { key: 'discord',  icon: 'fa-brands fa-discord',  label: 'Discord' },
  { key: 'youtube',  icon: 'fa-brands fa-youtube',  label: 'YouTube' },
  { key: 'twitter',  icon: 'fa-brands fa-x-twitter', label: 'X (Twitter)' },
  { key: 'tiktok',   icon: 'fa-brands fa-tiktok',   label: 'TikTok' },
  { key: 'whatsapp', icon: 'fa-brands fa-whatsapp',  label: 'WhatsApp' },
];

export default function Footer() {
  const [socials, setSocials] = useState({});
  const [contacts, setContacts] = useState({
    general: 'hello@loopbridge.network',
    press: 'press@loopbridge.network',
    support: 'support@loopbridge.network',
  });

  useEffect(() => {
    miscApi.siteConfig()
      .then((cfg) => {
        if (cfg.socials) setSocials(cfg.socials);
        if (cfg.contacts) setContacts((prev) => ({ ...prev, ...cfg.contacts }));
      })
      .catch(() => { /* use defaults */ });
  }, []);

  return (
    <footer>
      <div className="footer-container">
        <div className="footer-content">
          <div className="first">
            <div className="logo">
              <img src="/images/logos/LB text no symbol black 2.png" alt="LoopBridge Logo" className="logo" />
            </div>
            <div className="motto">Your Companion Through Every Stage of Post-Modern Finance</div>
          </div>
          <div className="middle">
            <div className="part">
              <h3>Product</h3>
              <Link to="/academy">Academy</Link>
              <Link to="/exchange">WhatsApp Exchange</Link>
              <Link to="/community">Community</Link>
            </div>
            <div className="part">
              <h3>Company</h3>
              <Link to="/about">About Us</Link>
              <Link to="/blog">Blog</Link>
              <a href={`mailto:${contacts.general}`}>Contact</a>
            </div>
            <div className="part">
              <h3>Legal</h3>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/disclaimer">Risk Disclaimer</Link>
            </div>
          </div>
          <div className="rest">
            <div className="socials">
              {SOCIAL_ICONS.map(({ key, icon, label }) => (
                <a
                  key={key}
                  href={socials[key] || '#'}
                  className="social-icon"
                  aria-label={label}
                  target={socials[key] ? '_blank' : undefined}
                  rel={socials[key] ? 'noopener noreferrer' : undefined}
                >
                  <i className={icon} />
                </a>
              ))}
            </div>
            <div className="contacts">
              <div className="contact-item">
                <span className="title">General Enquiries</span>
                <a href={`mailto:${contacts.general}`} className="email">{contacts.general}</a>
              </div>
              <div className="contact-item">
                <span className="title">Media Enquiries</span>
                <a href={`mailto:${contacts.press}`} className="email">{contacts.press}</a>
              </div>
              <div className="contact-item">
                <span className="title">Open a ticket</span>
                <a href={`mailto:${contacts.support}`} className="email">{contacts.support}</a>
              </div>
            </div>
          </div>
        </div>
        <div className="disclaimer">
          We respect your privacy. LoopBridge does not sell your data. Read our <Link to="/privacy">Privacy Policy</Link> to understand how we collect and protect your information.<br />
          By using LoopBridge tools — the Academy, Exchange, and Community — you agree to our <Link to="/terms">Terms of Service</Link>. Please review them before trading or joining.<br />
          Crypto assets are volatile and involve risk. LoopBridge provides education, community, and tools, but financial decisions are your responsibility. Learn before you trade.<br />
          © {new Date().getFullYear()} Loopbridge. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import Newsletter from '../components/Newsletter';
import { miscApi } from '../api';
import '../styles/academy.css';
import '../styles/community.css';

const PLATFORM_MAP = {
  whatsapp: 'whatsapp',
  discord: 'discord',
  youtube: 'youtube',
  twitter: 'twitter',
  telegram: 'telegram',
};

export default function Community() {
  const navigate = useNavigate();
  const [socials, setSocials] = useState({});

  useEffect(() => {
    miscApi.siteConfig()
      .then((cfg) => { if (cfg.socials) setSocials(cfg.socials); })
      .catch(() => {});
  }, []);

  function getSocialLink(key) {
    return socials[key] || '#';
  }

  return (
    <>
      <SEO
        title="Community — LoopBridge"
        description="Join the LoopBridge community. Connect with learners, traders, and builders in the Web3 space."
      />

      <div className="community-page">
      <section className="community-hero">
        <div className="section-container">
          <div className="body">
            <h1>Grow Smarter, Together</h1>
            <p>Progress in web3 often relies on being in sync with the rest of the community – moving when the market moves, and learning fast enough to keep up with the wave.</p>
            <button className="community-hero-btn" onClick={() => {
              const el = document.querySelector('.pathways');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}>Join the Community</button>
            <div className="community-hero-img">
              <img src="/images/community-hands.svg" alt="Hero Picture" />
            </div>
          </div>
        </div>
      </section>

      <section className="pathways">
        <div className="section-container">
          <h2>Community Platforms (Where to Join)</h2>
          <p>Join LoopBridge through the channels below</p>
          <div className="platforms">
            <div className="platform-card-item">
              <div className="platform-icon whatsapp"><i className="fa-brands fa-whatsapp" /></div>
              <h4 className="platform-name">WhatsApp</h4>
              <div className="platform-body">
                <p className="platform-subheading">Trade, chat, and share updates instantly — the fastest way to stay in the loop.</p>
                <a href={getSocialLink('whatsapp')} className="platform-link" target="_blank" rel="noopener noreferrer">Join the Community →</a>
              </div>
            </div>
            <div className="platform-card-item">
              <div className="platform-icon discord"><i className="fa-brands fa-discord" /></div>
              <h4 className="platform-name">Discord</h4>
              <div className="platform-body">
                <p className="platform-subheading">Join structured discussions, complete fun tasks, voice sessions, and live strategy rooms.</p>
                <a href={getSocialLink('discord')} className="platform-link" target="_blank" rel="noopener noreferrer">Join the Community →</a>
              </div>
            </div>
            <div className="platform-card-item">
              <div className="platform-icon youtube"><i className="fa-brands fa-youtube" /></div>
              <h4 className="platform-name">YouTube</h4>
              <div className="platform-body">
                <p className="platform-subheading">Watch community-led lessons, live sessions, and event replays.</p>
                <a href={getSocialLink('youtube')} className="platform-link" target="_blank" rel="noopener noreferrer">Join the Community →</a>
              </div>
            </div>
            <div className="platform-card-item">
              <div className="platform-icon twitter"><i className="fa-brands fa-x-twitter" /></div>
              <h4 className="platform-name">X (Twitter)</h4>
              <div className="platform-body">
                <p className="platform-subheading">Follow the movement, grow your X following, and join public discussions.</p>
                <a href={getSocialLink('twitter')} className="platform-link" target="_blank" rel="noopener noreferrer">Join the Community →</a>
              </div>
            </div>
            <div className="platform-card-item">
              <div className="platform-icon telegram"><i className="fa-brands fa-telegram" /></div>
              <h4 className="platform-name">Telegram</h4>
              <div className="platform-body">
                <p className="platform-subheading">Signals, insights, and updates in real time. Learn, trade, and grow with people moving in sync through New Finance.</p>
                <a href={getSocialLink('telegram')} className="platform-link" target="_blank" rel="noopener noreferrer">Join the Community →</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Newsletter variant="community" />
      </div>
    </>
  );
}

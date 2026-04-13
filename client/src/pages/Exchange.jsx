import { useState, useEffect, useRef, useCallback } from 'react';
import SEO from '../components/SEO';
import { miscApi } from '../api';
import '../styles/exchange.css';

const COINS = 'bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,tron';
const SYMBOL_MAP = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
  ripple: 'XRP', cardano: 'ADA', dogecoin: 'DOGE', tron: 'TRX',
};
const FALLBACK = [
  { id: 'bitcoin', name: 'Bitcoin', image: '', current_price: 87432.1, price_change_percentage_24h: 1.24 },
  { id: 'ethereum', name: 'Ethereum', image: '', current_price: 2015.5, price_change_percentage_24h: -0.85 },
  { id: 'solana', name: 'Solana', image: '', current_price: 138.2, price_change_percentage_24h: 3.42 },
  { id: 'binancecoin', name: 'BNB', image: '', current_price: 612.3, price_change_percentage_24h: 0.52 },
  { id: 'ripple', name: 'XRP', image: '', current_price: 2.41, price_change_percentage_24h: -1.1 },
  { id: 'cardano', name: 'Cardano', image: '', current_price: 0.72, price_change_percentage_24h: 2.3 },
  { id: 'dogecoin', name: 'Dogecoin', image: '', current_price: 0.17, price_change_percentage_24h: -0.33 },
  { id: 'tron', name: 'TRON', image: '', current_price: 0.23, price_change_percentage_24h: 0.92 },
];

const STEP_DURATIONS = [6000, 4000, 14000, 6000];

function formatPrice(price) {
  if (price >= 1) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + price.toFixed(4);
}

export default function Exchange() {
  const [coins, setCoins] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [whatsappLink, setWhatsappLink] = useState('#');
  const timerRef = useRef(null);

  useEffect(() => {
    miscApi.siteConfig()
      .then((cfg) => { if (cfg.socials?.whatsapp) setWhatsappLink(cfg.socials.whatsapp); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`)
      .then((r) => r.json())
      .then((data) => setCoins(data.length ? data : FALLBACK))
      .catch(() => setCoins(FALLBACK));
  }, []);

  const goToStep = useCallback((idx) => {
    setActiveStep(idx);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => goToStep((idx + 1) % 4), STEP_DURATIONS[idx]);
  }, []);

  useEffect(() => {
    goToStep(0);
    return () => clearTimeout(timerRef.current);
  }, [goToStep]);

  return (
    <>
      <SEO
        title="Exchange — LoopBridge"
        description="Compare crypto exchanges side by side. Find the best platform for your trading needs."
      />

      <section className="exchange-hero">
        <div className="section-container">
          <div className="banner">
            <div className="left vector">
              <img src="/images/left-vector.svg" alt="Vector Pattern" />
            </div>
            <div className="body">
              <h1>
                Trade <span className="accent-two">Crypto</span> Where You Already Chat
              </h1>
              <p>
                No New Apps. No confusing dashboards. LoopBridge Exchange lets you trade Naira ↔ Crypto directly on WhatsApp and Telegram - fast, safe and transparent.
              </p>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="exchange-hero-btn" style={{ textDecoration: 'none' }}>Trade Now</a>
            </div>
            <div className="right vector">
              <img src="/images/right-vector.svg" alt="Vector Pattern" />
            </div>
          </div>
          <div className="marquee">
            {[0, 1].map((copy) => (
              <div className="marquee-content" key={copy}>
                {coins.map((coin, i) => {
                  const change = coin.price_change_percentage_24h || 0;
                  const symbol = SYMBOL_MAP[coin.id] || coin.symbol?.toUpperCase() || '';
                  return (
                    <div className="currency" key={`${coin.id}-${copy}-${i}`}>
                      <div className="left">
                        <div className="icon">
                          {coin.image ? (
                            <img src={coin.image} alt={coin.name} style={{ width: 40, height: 40, borderRadius: '50%' }} />
                          ) : (
                            <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e9fded', borderRadius: '50%', fontWeight: 600, fontSize: 14 }}>
                              {symbol.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div className="name">
                          <div className="full">{coin.name}</div>
                          <div className="short">{symbol}</div>
                        </div>
                      </div>
                      <div className="numbers">
                        <div className="value">{formatPrice(coin.current_price)}</div>
                        <div className={`change ${change >= 0 ? 'positive' : 'negative'}`}>
                          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="exchange-pathways">
        <div className="section-container">
          <div className="heading">
            <h2>How it Works</h2>
            <p>LoopBridge Exchange was built to make crypto trading as simple as sending a  message. You chat, you confirm, and your trade happens.</p>
          </div>
          <div className="section-body">
            <div className="slide-counter">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`slide${activeStep === i ? ' active' : ''}`} onClick={() => goToStep(i)} />
              ))}
            </div>
            <div className="steps">
              <div className={`step${activeStep === 0 ? ' active' : ''}`} onClick={() => goToStep(0)}>
                <div className="number">1</div>
                <div className="step-body">
                  <h4 className="step-title">Start a Chat</h4>
                  <p className="step-description">Open WhatsApp to begin your trade. You'll connect with the official LoopBridge channel instantly.</p>
                </div>
              </div>
              <div className={`step${activeStep === 1 ? ' active' : ''}`} onClick={() => goToStep(1)}>
                <div className="number">2</div>
                <div className="step-body">
                  <h4 className="step-title">Confirm Live Rates</h4>
                  <p className="step-description">You'll see Naira ↔ Crypto rates live in chat — transparent and updated in real time.</p>
                </div>
              </div>
              <div className={`step${activeStep === 2 ? ' active' : ''}`} onClick={() => goToStep(2)}>
                <div className="number">3</div>
                <div className="step-body">
                  <h4 className="step-title">Send & Receive Securely</h4>
                  <p className="step-description">Make your transfer safely through verified wallets. Every transaction is kept & confirmed inside the chat.</p>
                </div>
              </div>
              <div className={`step${activeStep === 3 ? ' active' : ''}`} onClick={() => goToStep(3)}>
                <div className="number">4</div>
                <div className="step-body">
                  <h4 className="step-title">Track & Learn</h4>
                  <p className="step-description">Stay in the loop with daily insights and rate notifications, right inside the same chat.</p>
                </div>
              </div>
            </div>
            <div className="gif">
              Apparently there's a GIF here
            </div>
          </div>
        </div>
      </section>

      <section className="perks-section">
        <div className="section-container">
          <div>
            <h2>Clear<span className="accent">.</span> Fast<span className="accent">.</span> Human<span className="accent">.</span></h2>
          </div>
          <div className="perks">
            <div className="perk-card-item">
              <div className="perk-icon blue"><i className="fa-solid fa-comment-dots" /></div>
              <div className="perk-body">
                <p className="perk-subheading">Trade where you already chat — no need for new apps or complicated dashboards.</p>
              </div>
            </div>
            <div className="perk-card-item">
              <div className="perk-icon green"><i className="fa-solid fa-naira-sign" /></div>
              <div className="perk-body">
                <p className="perk-subheading">See live rates before you confirm- Transparent Naira ↔ Crypto prices, no hidden  fees.</p>
              </div>
            </div>
            <div className="perk-card-item">
              <div className="perk-icon purple"><i className="fa-solid fa-user-group" /></div>
              <div className="perk-body">
                <p className="perk-subheading">Real people, real support — all transactions are overseen and executed by verified  LoopBridge reps.</p>
              </div>
            </div>
            <div className="perk-card-item">
              <div className="perk-icon green"><i className="fa-solid fa-clock" /></div>
              <div className="perk-body">
                <p className="perk-subheading">Instant transactions — buys and sells processed in minutes, not hours.</p>
              </div>
            </div>
            <div className="perk-card-item">
              <div className="perk-icon purple"><i className="fa-solid fa-wallet" /></div>
              <div className="perk-body">
                <p className="perk-subheading">Secure wallets, trusted partners — every trade flows through verified liquidity  channels.</p>
              </div>
            </div>
            <div className="perk-card-item">
              <div className="perk-icon blue"><i className="fa-solid fa-bell" /></div>
              <div className="perk-body">
                <p className="perk-subheading">Updates in real time — get rate alerts, confirmations, and insights right inside  WhatsApp or Telegram.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="warnings">
        <div className="section-container">
          <div className="inner-section">
            <div className="warning-body">
              <h2 className="green"> <i className="fa-solid fa-circle-info" /> Disclaimer</h2>
              <p>Crypto isn't guesswork, but it's not risk-free either. We built LoopBridge to make trading  clearer and safer, not to guarantee profits. Always double-check details, trade responsibly,  and keep learning as you go.</p>
            </div>
          </div>
          <div className="inner-section">
            <div className="warning-body">
              <h2 className="yellow"> <i className="fa-solid fa-shield-halved" /> Trust</h2>
              <p>Every transaction on LoopBridge is verified, recorded, and transparent. You'll always know  your rate before confirming and see your confirmation the moment it clears. Clarity is our standard.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

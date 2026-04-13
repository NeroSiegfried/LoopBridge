import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import Newsletter from '../components/Newsletter';
import '../styles/home.css';

const BASE_COLORS = [
  '#79EC94','#79ECA9','#79ECAB','#7996EC','#799CEC','#79D3EC','#79EC87','#79ECAF',
  '#79ECB2','#79ECB8','#79ECD7','#79A5EC','#79A9EC','#79ABEC','#79B4EC','#79B8EC',
  '#79BAEC','#79BEEC','#79CDEC','#79D7EC','#79DEEC','#79E8EC','#79EC83','#79EC8C',
  '#79EC9C','#79ECA5','#79ECB6','#79ECBC','#79ECBE','#79ECC4','#79ECD5','#79ECDB',
  '#7FEC79',
];

function getRandomColor() {
  const base = BASE_COLORS[Math.floor(Math.random() * BASE_COLORS.length)];
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const rr = Math.min(255, Math.max(0, r + Math.floor(Math.random() * 30 - 15)));
  const gg = Math.min(255, Math.max(0, g + Math.floor(Math.random() * 30 - 15)));
  const bb = Math.min(255, Math.max(0, b + Math.floor(Math.random() * 30 - 15)));
  return `rgb(${rr}, ${gg}, ${bb})`;
}

export default function Home() {
  const navigate = useNavigate();
  const circleRef = useRef(null);

  const createCircle = useCallback(() => {
    const el = circleRef.current;
    if (!el) return;
    const circle = document.createElement('div');
    circle.classList.add('circle');
    const size = Math.floor(Math.random() * 16) + 10;
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.left = `${Math.random() * 100}%`;
    circle.style.top = `${Math.random() * 100}%`;
    circle.style.backgroundColor = getRandomColor();
    const duration = Math.random() * 5 + 5;
    circle.style.animationDuration = `${duration}s`;
    circle.style.setProperty('--translateX', `${Math.random() * 6.25 - 3.125}rem`);
    circle.style.setProperty('--translateY', `${Math.random() * 6.25 - 3.125}rem`);
    el.appendChild(circle);
    setTimeout(() => { circle.remove(); createCircle(); }, duration * 1000);
  }, []);

  useEffect(() => {
    for (let i = 0; i < 40; i++) createCircle();
  }, [createCircle]);

  return (
    <>
      <SEO
        title="LoopBridge — Your Bridge to Web3"
        description="LoopBridge is a crypto education platform with courses, articles, exchange comparisons, and a growing Web3 community."
      />

      <header className="hero">
        <div className="section-container">
          <div className="hero-body">
            <h1>Your Companion Through Every Stage of Post-Modern Finance</h1>
            <p>
              Learn practical Web3, trade Naira ↔ Crypto on WhatsApp, master futures,
              catch airdrops, and spot projects early – inside one growing community.
            </p>
            <div className="buttons">
              <button className="hero-btn btn-primary" onClick={() => navigate('/exchange')}>Trade Now</button>
              <button className="hero-btn" onClick={() => navigate('/academy')}>Start Learning</button>
            </div>
          </div>
          <div className="hero-img">
            <img src="/images/Homepage 1.png" alt="Hero Picture" />
          </div>
        </div>
      </header>

      <section className="why">
        <div className="section-container">
          <h2>Why LoopBridge Exists</h2>
          <div className="sections">
            <div className="section discovered">
              <h3 className="section-title"><span className="emoji">🤔</span>What we discovered</h3>
              <div className="section-body">
                Finance is changing in front of our eyes. One day it's a new coin, the next
                it's futures, an airdrop, NFTs, or a project that everyone is suddenly talking
                about. Most people either jump in blind or stand back confused — both are risky.
              </div>
              <div className="vector">
                <img src="/images/what-we-discovered-vector.svg" alt="Vector of a stack of coins" />
              </div>
            </div>
            <div className="section solution">
              <h3 className="section-title"><span className="emoji">💡</span>Our Solution</h3>
              <div className="section-body">
                LoopBridge was built to give people a clearer way forward. We give you lessons
                that turn into practice in our Academy, a way to trade directly on WhatsApp
                without extra apps, and a community where results and strategies circulate daily.
              </div>
              <div className="vector">
                <img src="/images/our-solution-vector.svg" alt="Vector of a stack of coins" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="join">
        <div className="section-container">
          <div className="join-top">
            <h2>Join the <br />LoopBridge Squad</h2>
            <p>
              Be part of a community that learns, trades, and grows together in Web3 and New Finance.
            </p>
            <div className="circle-effect" ref={circleRef} />
          </div>
          <div className="join-bottom">
            <div className="box academy">
              <div className="icon"><i className="fa-solid fa-book-open" /></div>
              <h3 className="box-title">Academy</h3>
              <div className="box-body">
                The specially curated Lessons that show you what Web3 looks like in practice, not just theory.
              </div>
              <button className="box-button" onClick={() => navigate('/academy')}>Learn Now</button>
            </div>
            <div className="box whatsapp">
              <div className="icon"><i className="fa-brands fa-whatsapp" /></div>
              <h3 className="box-title">WhatsApp Exchange (Naira)</h3>
              <div className="box-body">
                No confusing apps. Trade Fiat ↔ Crypto directly on WhatsApp, where you already chat every day.
              </div>
              <button className="box-button" onClick={() => navigate('/exchange')}>Trade on WhatsApp</button>
            </div>
            <div className="box community">
              <div className="icon"><i className="fa-solid fa-users" /></div>
              <h3 className="box-title">Community</h3>
              <div className="box-body">
                Your portfolio grows faster when you're not alone. Our community is where knowledge,
                strategies, and results circulate daily.
              </div>
              <button className="box-button" onClick={() => navigate('/community')}>Join the Community</button>
            </div>
            <div className="box newsletter">
              <div className="icon"><i className="fa-solid fa-newspaper" /></div>
              <h3 className="box-title">Finance Newsletter</h3>
              <div className="box-body">
                Don't wait for the trend to go mainstream. Our newsletter gives you a first look at
                the shifts shaping New Finance, so you can act quickly.
              </div>
              <button className="box-button" onClick={() => navigate('/blog')}>Subscribe Now</button>
            </div>
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}

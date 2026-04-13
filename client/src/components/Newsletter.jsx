import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newsletterApi } from '../api';
import '../styles/newsletter.css';

export default function Newsletter({ variant = 'default' }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');

  async function handleSubscribe(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const data = await newsletterApi.subscribe(email.trim());
      setStatus('success');
      setMessage(data.message || 'You\'re subscribed!');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    }
  }

  function handleJoinCommunity() {
    navigate('/community');
  }

  if (variant === 'blog') {
    return (
      <section className="newsletter">
        <div className="section-container">
          <div className="inner-section">
            <div className="body">
              <h2>Don't Miss the Next Wave of New Finance</h2>
              <p>Join a growing number of people reading the PostModern Finance newsletter — foresight before trends go mainstream.</p>
              <form className="subscribe-section" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="newsletter-input"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
                  required
                />
                <button
                  type="submit"
                  className="newsletter-button"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Subscribing…' : 'Subscribe Now'}
                </button>
              </form>
              {status === 'success' && <p className="subscribe-feedback success">{message}</p>}
              {status === 'error' && <p className="subscribe-feedback error">{message}</p>}
            </div>
            <div className="image" />
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'academy') {
    return (
      <section className="newsletter">
        <div className="section-container">
          <div className="inner-section">
            <div className="body">
              <h2>Learn Together<span className="accent">,</span> Grow Together<span className="accent">.</span></h2>
              <p>Join the LoopBridge community to discuss lessons, share strategies, and apply what you learn in real time.</p>
              <button className="newsletter-button" onClick={handleJoinCommunity}>Join the Community</button>
            </div>
            <div className="image">
              <img src="/images/globe.png" alt="Globe with a network of people around it" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'community') {
    return (
      <section className="newsletter">
        <div className="section-container">
          <div className="inner-section">
            <div className="body">
              <h2>Learn Together<span className="accent">,</span> Grow Together<span className="accent">.</span></h2>
              <p>Join the LoopBridge community to discuss lessons, share strategies, and apply what you learn in real time.</p>
              <button className="newsletter-button" onClick={handleJoinCommunity}>Join the Community</button>
            </div>
            <div className="image">
              <img src="/images/globe.png" alt="Globe with a network of people around it" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="newsletter">
      <div className="section-container">
        <div className="inner-section">
          <div className="body">
            <h2>Grow Smarter<span className="accent">.</span><br />Trade Faster<span className="accent">.</span> Stay Ahead<span className="accent">.</span></h2>
            <p>LoopBridge gives you a place to learn, trade, and share wins — so you're always inside the action, never left outside it.</p>
            <button className="newsletter-button" onClick={handleJoinCommunity}>Join the Community</button>
          </div>
          <div className="image">
            <img src="/images/globe.png" alt="Globe with a network of people around it" />
          </div>
        </div>
      </div>
    </section>
  );
}

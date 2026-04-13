import { Link, useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import Newsletter from '../components/Newsletter';
import '../styles/academy.css';

export default function Academy() {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Academy — LoopBridge"
        description="Learn crypto from scratch. LoopBridge Academy offers beginner to advanced courses on blockchain, DeFi, trading, and more."
      />

      <header className="academy-hero">
        <div className="section-container">
          <div className="hero-body">
            <h1>Learn <span className="accent-two">Web3</span> in Practice, <br />
              Not Just in Theory
            </h1>
            <p>LoopBridge Academy turns curiosity into confidence through hands-on lessons, visual explainers, and real-world application.</p>
            <button className="primary-btn" onClick={() => navigate('/courses')}>Start Learning</button>
          </div>
          <div className="academy-hero-img">
            <img src="/images/Academy (Top Banner).png" alt="Hero Picture" />
          </div>
        </div>
      </header>

      <section className="pathways">
        <div className="section-container">
          <h2>Learning Pathways</h2>
          <p>Clear paths designed to help you learn, apply, and grow in New Finance at your own pace.</p>
          <div className="path-cards">
            <div className="box articles">
              <div className="box-content">
                <div className="box-head">
                  <div className="card-highlight">Getting Started in New Finance</div>
                  <div className="icon"><i className="fa-solid fa-newspaper" /></div>
                  <h3 className="box-title">Articles</h3>
                </div>
                <div className="box-body">
                  <p>Short, practical reads that break down Web3, markets, and emerging trends without the noise. Designed to help you understand everything.</p>
                  <Link to="/articles"><button className="box-button">Read Articles</button></Link>
                </div>
              </div>
            </div>
            <div className="box courses">
              <div className="box-content">
                <div className="box-head">
                  <div className="card-highlight">Building and Earning in Web3</div>
                  <div className="icon"><i className="fa-solid fa-book-open" /></div>
                  <h3 className="box-title">Courses</h3>
                </div>
                <div className="box-body">
                  <p>Structured learning paths that guide you from fundamentals to confident application. Every course focuses on real-world use.</p>
                  <Link to="/courses"><button className="box-button">Start Learning</button></Link>
                </div>
              </div>
            </div>
            <div className="box glossary">
              <div className="box-content">
                <div className="box-head">
                  <div className="card-highlight">Trading and Application</div>
                  <div className="icon"><i className="fa-solid fa-book" /></div>
                  <h3 className="box-title">Glossary</h3>
                </div>
                <div className="box-body">
                  <p>Clear, simple explanations of crypto and Web3 terms in plain language. Built to remove confusion so you can make informed decisions.</p>
                  <button className="box-button" onClick={() => navigate('/articles')} title="Glossary coming soon — browse articles for now">Browse Glossary</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="philosophy">
        <div className="section-container">
          <h2 className="tagline">Why <span className="accent-two">We Teach</span> the Way We Do</h2>
          <div className="philosophy-body">
            <p>We believe learning New Finance should be practical, falsifiable, and community-driven. That's why LoopBridge Academy is designed around real use cases, visual lessons, and peer collaboration.</p>
            <p>We call this approach PostModern Learning — because just like PostModern Finance, it's open, interactive, and shaped by participation.</p>
          </div>
        </div>
      </section>

      <Newsletter variant="academy" />
    </>
  );
}

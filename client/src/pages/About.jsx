import SEO from '../components/SEO';
import Newsletter from '../components/Newsletter';
import '../styles/about.css';
import '../styles/academy.css';

export default function About() {
  return (
    <>
      <SEO
        title="About Us — LoopBridge"
        description="Meet the team behind LoopBridge — our mission, vision, and the people building the bridge to Web3."
      />

      <section className="about-hero">
        <div className="heading">
          <h1 className="heading-title">The <span className="accent-two">Vision</span> Behind LoopBridge</h1>
          <p className="heading-description">Web3 should be clear, open, and within reach for everyone - a space where people connect, build, and create without barriers or confusion.</p>
        </div>
        <div className="hero-pictures">
          <div className="pic">
            <img src="/images/side-view-couple-spending-time-outdoors.png" alt="placeholder image" />
          </div>
          <div className="middle-pics">
            <div className="pic">
              <img src="/images/portrait-happy-young-women.png" alt="placeholder" />
            </div>
            <div className="pic">
              <img src="/images/people-identifical-clothes-african-couple-autumn-city.png" alt="placeholder" />
            </div>
          </div>
          <div className="last pic">
            <img src="/images/people-office-work-day.png" alt="placeholder" />
          </div>
        </div>
      </section>

      <section className="what-we-do">
        <div className="section-container">
          <div className="section-image">
            <img src="/images/About us lightbulb.png" alt="Lightbulb showing four people connected on the inside around the LoopBridge logo" />
          </div>
          <div className="section-body">
            <h2 className="section-heading">What We Do</h2>
            <div className="section-description">
              <p>LoopBridge exists to make that possible by connecting people, tools, and knowledge in one ecosystem.</p>
              <p>We are building a platform where anyone, from first-time traders to experienced builders, can learn, trade, and grow confidently in Web3.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mission">
        <div className="section-container">
          <div className="section-body">
            <h2 className="section-heading">Our Mission and Ecosystem</h2>
            <div className="section-description">
              <p>Our mission is to help millions of people participate fully in New Finance by removing the barriers that make crypto seem complex or inaccessible.</p>
            </div>
          </div>
          <div className="section-body">
            <div className="cards">
              <div className="card-item">
                <div className="card-icon green-bg"><i className="fa-brands fa-whatsapp" /></div>
                <h4 className="card-name">LoopBridge Community</h4>
                <p className="card-subheading">People share strategies, signals, and portfolio growth daily.</p>
              </div>
              <div className="card-item">
                <div className="card-icon orange-bg"><i className="fa-brands fa-whatsapp" /></div>
                <h4 className="card-name">LoopBridge Exchange</h4>
                <p className="card-subheading">We make it easy to trade Naira and Crypto in a familiar environment.</p>
              </div>
              <div className="card-item">
                <div className="card-icon blue-bg"><i className="fa-brands fa-whatsapp" /></div>
                <h4 className="card-name">PostModern Newsletter</h4>
                <p className="card-subheading">We deliver foresight into emerging opportunities before they go mainstream.</p>
              </div>
              <div className="card-item">
                <div className="card-icon purple-bg"><i className="fa-brands fa-whatsapp" /></div>
                <h4 className="card-name">LoopBridge Academy</h4>
                <p className="card-subheading">We teach practical lessons that turn into action.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="vision">
        <div className="section-container">
          <div className="section-image">
            <img src="/images/family-enjoying-their-quality-winter-time 1.png" alt="Family enjoying their quality winter time" />
          </div>
          <div className="section-body">
            <h2 className="section-heading">Our Culture and Vision</h2>
            <div className="section-description">
              <p>Beyond tools, we are shaping a culture of clarity, transparency, and collaboration. We support learners, traders, and creators who are redefining what financial access looks like in the onchain world.</p>
              <p>Together, we are building a movement where New Finance is not a privilege; it is an open door for anyone, anywhere.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="team">
        <div className="section-container">
          <div className="section-heading">
            <h2>Meet the Team<br /><span className="accent-three">Driving Our Success</span></h2>
          </div>
          <div className="members">
            <div className="member">
              <div className="member-image">
                <img src="/images/CEO.png" alt="portrait of the CEO, Oluwatimilehin Fadimoroye" />
              </div>
              <div className="member-body">
                <h4 className="member-name">Oluwatimilehin Fadimoroye</h4>
                <p className="member-role">Founder / CEO</p>
              </div>
            </div>
            <div className="member">
              <div className="member-image">
                <img src="/images/CEO.png" alt="portrait of the CEO, Oluwatimilehin Fadimoroye" />
              </div>
              <div className="member-body">
                <h4 className="member-name">Oluwatimilehin Fadimoroye</h4>
                <p className="member-role">Founder / CEO</p>
              </div>
            </div>
            <div className="member">
              <div className="member-image">
                <img src="/images/CEO.png" alt="portrait of the CEO, Oluwatimilehin Fadimoroye" />
              </div>
              <div className="member-body">
                <h4 className="member-name">Oluwatimilehin Fadimoroye</h4>
                <p className="member-role">Founder / CEO</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}

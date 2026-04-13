import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import '../styles/courses.css';
import '../styles/academy.css';

export default function Courses() {
  return (
    <>
      <SEO
        title="Courses — LoopBridge"
        description="Browse all LoopBridge courses across beginner, intermediate, and advanced tracks."
      />

      <header className="courses-hero">
        <div className="section-container">
          <div className="hero-body">
            <h1>Courses for Every Stage of New Finance</h1>
            <p>LoopBridge courses are designed to guide you from beginner to advanced Web3 learning through real-world application.</p>
          </div>
          <div className="courses-hero-img">
            <div className="image-background">
              <img src="/images/courses-hero-illustration.svg" alt="Hero Picture" />
            </div>
          </div>
        </div>
      </header>

      <section className="pathways courses-pathways">
        <div className="section-container">
          <h2>Learning Tracks</h2>
          <div className="path-cards">
            <div className="box beginner">
              <div className="box-content">
                <div className="box-head">
                  <div className="box-image" />
                  <h3 className="box-title">Beginner Track</h3>
                </div>
                <div className="box-body">
                  <p>Build a strong foundation in Web3, crypto, and security.</p>
                  <Link to="/beginner">
                    <button className="box-button">
                      <div className="text">Start Track</div>
                      <i className="fa-solid fa-angle-right" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
            <div className="box intermediate">
              <div className="box-content">
                <div className="box-head">
                  <div className="box-image" />
                  <h3 className="box-title">Intermediate Track</h3>
                </div>
                <div className="box-body">
                  <p>Learn how to trade, read markets, and apply strategies</p>
                  <Link to="/intermediate">
                    <button className="box-button">
                      <div className="text">Start Track</div>
                      <i className="fa-solid fa-angle-right" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
            <div className="box advanced">
              <div className="box-content">
                <div className="box-head">
                  <div className="box-image" />
                  <h3 className="box-title">Advanced Track</h3>
                </div>
                <div className="box-body">
                  <p>Explore deeper participation, analysis, and onchain opportunities</p>
                  <Link to="/advanced">
                    <button className="box-button">
                      <div className="text">Start Track</div>
                      <i className="fa-solid fa-angle-right" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

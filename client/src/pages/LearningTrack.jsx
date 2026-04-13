import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import CourseCard from '../components/CourseCard';
import { coursesApi } from '../api';
import '../styles/learning_track.css';

const TRACK_META = {
  beginner: {
    title: 'Beginner Track',
    description: 'Learn the basics of Web3, wallets, and crypto trading through simple, practical lessons designed for first-time users.',
    image: '/images/Beginner_Track_Hero_img.svg',
    seoDescription: 'Start your crypto journey with beginner-friendly courses on blockchain fundamentals, wallets, and DeFi basics.',
  },
  intermediate: {
    title: 'Intermediate Track',
    description: 'Learn the basics of Web3, wallets, and crypto trading through simple, practical lessons designed for first-time users.',
    image: '/images/Intermediate_Track_Hero_img.svg',
    seoDescription: 'Take your crypto knowledge further with intermediate courses on trading, DeFi strategies, and market analysis.',
  },
  advanced: {
    title: 'Advanced Track',
    description: 'Master advanced Web3 concepts, DeFi strategies, smart contract development, and blockchain architecture for experienced practitioners.',
    image: '/images/Intermediate_Track_Hero_img.svg',
    seoDescription: 'Master advanced crypto concepts including yield farming, on-chain analysis, and alpha strategies.',
  },
};

export default function LearningTrack({ track = 'beginner' }) {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('all');
  const [loading, setLoading] = useState(true);
  const searchRef = useRef(null);

  const meta = TRACK_META[track] || TRACK_META.beginner;

  useEffect(() => {
    setLoading(true);
    coursesApi.list({ track })
      .then((data) => setCourses(data.courses || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [track]);

  const filtered = search
    ? courses.filter((c) =>
        c.title?.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
      )
    : courses;

  const sortedCourses = sortBy === 'all'
    ? filtered
    : filtered.filter((c) => {
        const isFree = !c.price || c.price === 'Free' || c.price === 0;
        return sortBy === 'free' ? isFree : !isFree;
      });

  return (
    <>
      <SEO
        title={`${meta.title} — LoopBridge Academy`}
        description={meta.seoDescription}
      />

      <header className="track-hero">
        <div className="section-container">
          <Link to="/courses" className="back-to-courses">
            <i className="fa-solid fa-angle-left" />
            <span>Back to all courses</span>
          </Link>
          <div className="track-inner-section">
            <div className="hero-body">
              <h1>{meta.title}</h1>
              <p>{meta.description}</p>
            </div>
            <div className="hero-image">
              <img src={meta.image} alt="Hero Image" />
            </div>
          </div>
        </div>
      </header>

      <section className="courses-section">
        <div className="section-container">
          <div className="controls">
            <div className="count">
              {loading ? 'Loading…' : `${filtered.length} Course${filtered.length !== 1 ? 's' : ''}`}
            </div>
            <div className="filter">
              <div className="search" onClick={() => searchRef.current?.focus()}>
                <span className="search-icon"><i className="fa-solid fa-magnifying-glass" /></span>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search for anything"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="dropdown-section" onClick={() => setSortOpen(!sortOpen)} style={{ position: 'relative', cursor: 'pointer' }}>
                {sortBy === 'all' ? 'All courses' : sortBy === 'free' ? 'Free' : 'Paid'}
                <span className="dropdown-btn">
                  <i className="fa-solid fa-angle-down" />
                </span>
                {sortOpen && (
                  <div className="dropdown-menu">
                    <div className="dropdown-item" onClick={(e) => { e.stopPropagation(); setSortBy('all'); setSortOpen(false); }}>All courses</div>
                    <div className="dropdown-item" onClick={(e) => { e.stopPropagation(); setSortBy('free'); setSortOpen(false); }}>Free</div>
                    <div className="dropdown-item" onClick={(e) => { e.stopPropagation(); setSortBy('paid'); setSortOpen(false); }}>Paid</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="courses" id="courses-grid">
            {loading ? null : sortedCourses.length === 0 ? (
              <p>No courses found.</p>
            ) : (
              sortedCourses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import Newsletter from '../components/Newsletter';
import { articlesApi } from '../api';
import { readingTime } from '../utils';
import '../styles/blog.css';

const DEFAULT_COVER = '/images/article-pic.jpg';

const CATEGORIES = ['All', 'Learning', 'News', 'Markets', 'Community', 'Airdrops', 'Culture', 'Project Watch'];

export default function Blog() {
  const [featured, setFeatured] = useState([]);
  const [feed, setFeed] = useState([]);
  const [category, setCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState('Recently Published');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  useEffect(() => {
    articlesApi.list()
      .then((data) => {
        const list = data.articles || data || [];
        setFeatured(list.filter((a) => a.featured).slice(0, 3));
        setFeed(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filtered = category === 'All' ? feed : feed.filter((a) => a.category === category);
  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'Recently Updated') return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    if (sortOrder === 'Most Read') return (b.views || 0) - (a.views || 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const visible = sorted.slice(0, visibleCount);

  return (
    <>
      <SEO
        title="Blog — LoopBridge"
        description="Insights from the new era of post-modern finance. Practical perspectives on Web3, crypto, and decentralized technology."
      />

      <div className="blog-page">
      <header className="blog-header">
        <div className="section-container">
          <div className="blog-inner-section">
            <h1>Insights from the New Era of Post-Modern Finance</h1>
            <p> Our writers, traders, and community members share practical insights to help you move confidently through the new landscape of Web3.</p>
          </div>
        </div>
      </header>

      <section className="featured">
        <div className="section-container">
          <h2>Featured Articles</h2>
          <div className="articles" id="featured-articles">
            {loading ? (
              <>
                <div className="article-card">
                  <div className="article-image" />
                  <div className="article-category">Category Name</div>
                  <h3 className="article-title">Article Title</h3>
                  <p className="article-description">5 min read</p>
                </div>
                <div className="article-card">
                  <div className="article-image" />
                  <div className="article-category">Category Name</div>
                  <h3 className="article-title">Article Title</h3>
                  <p className="article-description">5 min read</p>
                </div>
                <div className="article-card">
                  <div className="article-image" />
                  <div className="article-category">Category Name</div>
                  <h3 className="article-title">Article Title</h3>
                  <p className="article-description">5 min read</p>
                </div>
              </>
            ) : (
              featured.map((a) => (
                <Link to={`/articles/${a.id}`} key={a.id}>
                  <div className="article-card">
                    <div className="article-image" style={{ backgroundImage: `url(${a.image || DEFAULT_COVER})` }}>
                    </div>
                    <div className="article-category">{a.category || 'Category Name'}</div>
                    <h3 className="article-title">{a.title}</h3>
                    <p className="article-description">{readingTime(a.content)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="feed">
        <div className="section-container">
          <h2>Articles Feed</h2>
          <div className="categories">
            <div className="category-buttons">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`category-button${category === cat ? ' active' : ''}`}
                  onClick={() => { setCategory(cat); setVisibleCount(6); }}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="dropdown-section" ref={dropdownRef}>
              <div
                className={`category-dropdown${dropdownOpen ? ' active' : ''}`}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {sortOrder} <span className="dropdown-btn">
                  <i className="fa-solid fa-angle-down" />
                </span>
              </div>
              {dropdownOpen && (
                <div className="dropdown-menu" style={{ display: 'flex' }}>
                  <div className="dropdown-item" onClick={() => { setSortOrder('Recently Updated'); setDropdownOpen(false); }}>Recently Updated</div>
                  <div className="dropdown-item" onClick={() => { setSortOrder('Most Read'); setDropdownOpen(false); }}>Most Read</div>
                </div>
              )}
            </div>
          </div>
          <div className="articles" id="feed-articles">
            {visible.map((a) => (
              <div className="article-container" key={a.id}>
                <Link to={`/articles/${a.id}`}>
                  <div className="article-card">
                    <div className="article-image" style={{ backgroundImage: `url(${a.image || DEFAULT_COVER})` }}>
                    </div>
                    <div className="article-category">{a.category || 'Category Name'}</div>
                    <h3 className="article-title">{a.title}</h3>
                    <p className="article-description">By {typeof a.author === 'object' ? a.author?.name : a.author || 'LoopBridge Team'} · {readingTime(a.content)}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          {visibleCount < sorted.length && (
            <button className="load-btn" onClick={() => setVisibleCount((c) => c + 6)}>
              Load More
            </button>
          )}
        </div>
      </section>

      <Newsletter variant="blog" />
      </div>
    </>
  );
}

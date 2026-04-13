import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import RecommendedForYou from '../components/RecommendedForYou';
import { articlesApi } from '../api';
import '../styles/articles.css';

const CATEGORIES = ['All topics', 'Altcoins', 'Basics', 'Bitcoin', 'Blockchain', 'Cryptocurrency', 'Defi', 'Ethereum', 'Guide', 'NFT', 'Security', 'Stablecoin', 'Ventures', 'Web3'];

export default function Articles() {
  const [articles, setArticles] = useState([]);
  const [category, setCategory] = useState('All topics');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articlesApi.list()
      .then((data) => {
        const list = data.articles || data || [];
        setArticles(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = category === 'All topics' ? articles : articles.filter((a) => a.category === category);

  return (
    <>
      <SEO
        title="Articles — LoopBridge"
        description="Browse crypto articles covering DeFi, trading strategies, market analysis, airdrops, and Web3 culture."
      />

      <div className="articles-page">
      <section className="featured">
        <div className="section-container">
          <h2>LoopBridge Articles</h2>
          <p>Our articles deliver practical insights on Web3, markets, and new financial trends — without the noise.</p>
          <div className="categories">
            <div className="category-buttons">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`category-button${category === cat ? ' active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="articles" id="articles-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Link to="#" key={i}>
                  <div className="article-card">
                    <div className="article-image">
                      <div className="article-category">Category Name</div>
                    </div>
                    <div className="article-body">
                      <div className="main">
                        <h3 className="article-title">Article Title</h3>
                        <p className="article-description">Loading…</p>
                      </div>
                      <p className="article-subscript">5 min read</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              filtered.map((a) => (
                <Link to={`/articles/${a.id}`} key={a.id}>
                  <div className="article-card">
                    <div className="article-image" style={a.image ? { backgroundImage: `url(${a.image})` } : {}}>
                      <div className="article-category">{a.category || 'Category Name'}</div>
                    </div>
                    <div className="article-body">
                      <div className="main">
                        <h3 className="article-title">{a.title}</h3>
                        <p className="article-description">{a.description || a.excerpt || ''}</p>
                      </div>
                      <p className="article-subscript">{a.readTime || '5 min read'}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <RecommendedForYou kind="articles" limit={4} />
      </div>
    </>
  );
}

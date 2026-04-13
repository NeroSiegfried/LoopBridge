import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { recommendationsApi } from '../api';
import { useAuth } from '../context/AuthContext';

/**
 * Displays personalised "Recommended for You" cards.
 *
 * Props:
 *   kind  – "articles" | "courses"
 *   limit – max items (default 4)
 */
export default function RecommendedForYou({ kind = 'articles', limit = 4 }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetcher = kind === 'articles'
      ? recommendationsApi.articles(limit)
      : recommendationsApi.courses(limit);

    fetcher
      .then((data) => setItems(data.recommendations || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, kind, limit]);

  if (!user || (!loading && items.length === 0)) return null;

  return (
    <section className="recommended-section" style={{ marginTop: '2.5rem' }}>
      <div className="section-container">
        <div className="rec-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--lb-green)', fontSize: '1rem' }} />
          <h3 style={{ fontFamily: 'var(--font-heading-variable)', fontWeight: 600, fontSize: '1.125rem' }}>
            Recommended for You
          </h3>
        </div>

        <div className="rec-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {loading ? (
            Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="rec-card rec-placeholder" style={{ background: 'var(--gray-light)', borderRadius: '0.75rem', height: '180px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))
          ) : (
            items.map((item) => {
              const isArticle = kind === 'articles';
              const linkTo = isArticle ? `/articles/${item.id}` : `/courses/${item.id}`;
              return (
                <Link to={linkTo} key={item.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="rec-card" style={{
                    background: 'white',
                    border: '1px solid var(--gray-mid, #e8ebef)',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                  >
                    {/* image banner */}
                    {item.image && (
                      <div style={{ height: '120px', backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    )}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                        {isArticle && item.category && (
                          <span style={{ fontSize: '0.6875rem', padding: '0.1rem 0.45rem', borderRadius: '1rem', background: 'var(--gray-light)', border: '1px solid var(--gray-mid)', color: 'var(--black-mid)', fontWeight: 500 }}>
                            {item.category}
                          </span>
                        )}
                        {!isArticle && item.level && (
                          <span style={{ fontSize: '0.6875rem', padding: '0.1rem 0.45rem', borderRadius: '1rem', background: 'var(--gray-light)', border: '1px solid var(--gray-mid)', color: 'var(--black-mid)', fontWeight: 500 }}>
                            {item.level}
                          </span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, lineHeight: 1.35 }}>
                        {item.title}
                      </h4>
                      {(item.excerpt || item.description) && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--black-mid)', marginTop: '0.25rem', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.excerpt || item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

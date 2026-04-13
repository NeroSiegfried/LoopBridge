import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { articlesApi } from '../api';
import { formatDate, readingTime } from '../utils';
import '../styles/articles.css';

export default function ArticleView() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    articlesApi.get(id)
      .then((data) => {
        setArticle(data);
        return articlesApi.list({ category: data.category, limit: 4 });
      })
      .then((data) => {
        const list = data.articles || data || [];
        setRelated(list.filter((a) => String(a.id) !== String(id)).slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="articles-page"><section className="article-section"><div className="section-container"><p>Loading…</p></div></section></div>;
  if (!article) return <div className="articles-page"><section className="article-section"><div className="section-container"><p>Article not found.</p></div></section></div>;

  return (
    <>
      <SEO
        title={`${article.title} — LoopBridge`}
        description={article.excerpt || article.description || ''}
        image={article.image}
      />

      <div className="articles-page">
      <section className="article-section">
        <div className="section-container">
          <div className="header">
            <h1 className="article-title">{article.title}</h1>
            {article.image && (
              <div className="article-image">
                <img src={article.image} alt={article.title} />
              </div>
            )}
            <div className="article-meta">
              <div className="author-info">
                <div className="author-image">
                  <img src={(typeof article.author === 'object' ? article.author?.avatar : null) || article.authorImage || '/images/user-placeholder.svg'} alt="image of author" />
                </div>
                <span className="author-name">{typeof article.author === 'object' ? article.author?.name : article.author || 'LoopBridge Team'}</span>
              </div>
              <div className="other-info">
                {article.createdAt && <div className="date">{formatDate(article.createdAt)}</div>}
                <div className="time">{readingTime(article.body || '')} min read</div>
              </div>
            </div>
          </div>
          <div
            className="body"
            dangerouslySetInnerHTML={{ __html: article.body || '' }}
          />
        </div>
      </section>

      {related.length > 0 && (
        <section className="related-articles">
          <div className="section-container">
            <h2>Similar Articles</h2>
            <div className="articles">
              {related.map((a) => (
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
              ))}
            </div>
          </div>
        </section>
      )}
      </div>
    </>
  );
}

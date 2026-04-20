import { Link } from 'react-router-dom';
import { truncate, readingTime } from '../utils';

const DEFAULT_COVER = '/images/article-pic.jpg';

export default function ArticleCard({ article, basePath = '' }) {
  const href = `/articles/${article.id}`;
  const authorName = typeof article.author === 'string' ? article.author : article.author?.name || 'LoopBridge Team';
  const category = Array.isArray(article.category) ? article.category[0] : article.category;

  return (
    <Link to={href} className="article-card-link">
      <div className="article-card">
        <div className="article-image" style={{ backgroundImage: `url(${article.image || DEFAULT_COVER})` }}>
          {category && <div className="article-category">{category}</div>}
        </div>
        <div className="article-body">
          <div className="main">
            <h3 className="article-title">{article.title}</h3>
            <p className="article-description">{truncate(article.description || article.excerpt, 100)}</p>
          </div>
          <p className="article-subscript">{readingTime(article.content)}</p>
        </div>
      </div>
    </Link>
  );
}

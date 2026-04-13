import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO';
import { dashboardApi, articlesApi, coursesApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/dashboard.css';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ articles: [], courses: [] });
  const [activeTab, setActiveTab] = useState('articles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    dashboardApi.get()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleDeleteArticle = async (id) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await articlesApi.delete(id);
      setData((d) => ({ ...d, articles: d.articles.filter((a) => a.id !== id) }));
    } catch (err) { alert(err.message); }
  };

  const handleDeleteCourse = async (id) => {
    if (!window.confirm('Delete this course?')) return;
    try {
      await coursesApi.delete(id);
      setData((d) => ({ ...d, courses: d.courses.filter((c) => c.id !== id) }));
    } catch (err) { alert(err.message); }
  };

  const handleResetData = async () => {
    if (!window.confirm('Reset all data to defaults?')) return;
    try {
      await fetch('/api/admin/reset', { method: 'POST', credentials: 'include' });
      const fresh = await dashboardApi.get();
      setData(fresh);
    } catch (err) { alert(err.message); }
  };

  if (loading) return <section className="dashboard-section"><div className="section-container"><div className="dashboard-body"><p>Loading dashboard…</p></div></div></section>;
  if (error) return <section className="dashboard-section"><div className="section-container"><div className="dashboard-body"><p style={{ color: 'red' }}>{error}</p></div></div></section>;

  return (
    <>
      <SEO title="Dashboard — LoopBridge" description="Manage your articles and courses." />
      <section className="dashboard-section">
        <div className="section-container">
          <div className="dashboard-body">
          <div className="dashboard-welcome">
            <h1 id="welcome-title">Dashboard</h1>
            <p id="welcome-sub">Manage your articles and courses</p>
          </div>

          <div className="stats-strip" id="stats-strip">
            <div className="stat-card">
              <div className="stat-number">{data.articles?.length || 0}</div>
              <div className="stat-label">Articles</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{data.courses?.length || 0}</div>
              <div className="stat-label">Courses</div>
            </div>
          </div>

          <div className="dashboard-actions">
            {isAdmin && (
              <button className="btn btn-ghost" onClick={handleResetData}>
                <i className="fa-solid fa-rotate-left" /> Reset Data
              </button>
            )}
          </div>

          <div className="dashboard-tabs">
            <button
              className={`dashboard-tab${activeTab === 'articles' ? ' active' : ''}`}
              onClick={() => setActiveTab('articles')}
            >
              Articles
            </button>
            <button
              className={`dashboard-tab${activeTab === 'courses' ? ' active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              Courses
            </button>
          </div>

          {activeTab === 'articles' && (
            <div id="articles-panel">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Author</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody id="articles-tbody">
                  {data.articles.map((a) => (
                    <tr key={a.id}>
                      <td className={`title-cell${a.deletedAt ? ' deleted-item' : ''}`}>{a.title}</td>
                      <td className="meta-cell">{a.category}</td>
                      <td className="meta-cell">{typeof a.author === 'object' ? a.author?.name : a.author}</td>
                      <td>
                        <div className="actions-cell">
                          <Link to={`/admin/edit-article/${a.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDeleteArticle(a.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.articles.length === 0 && (
                    <tr><td colSpan={4} className="dashboard-empty">No articles yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'courses' && (
            <div id="courses-panel">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Track</th>
                    <th>Duration</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody id="courses-tbody">
                  {data.courses.map((c) => (
                    <tr key={c.id}>
                      <td className={`title-cell${c.deletedAt ? ' deleted-item' : ''}`}>{c.title}</td>
                      <td className="meta-cell">{c.level}</td>
                      <td className="meta-cell">{c.duration}</td>
                      <td>
                        <div className="actions-cell">
                          <Link to={`/admin/edit-course/${c.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleDeleteCourse(c.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.courses.length === 0 && (
                    <tr><td colSpan={4} className="dashboard-empty">No courses yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      </section>
    </>
  );
}

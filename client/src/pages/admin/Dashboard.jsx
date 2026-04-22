import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO from '../../components/SEO';
import { dashboardApi, articlesApi, coursesApi, adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/dashboard.css';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ articles: [], courses: [] });
  const [activeTab, setActiveTab] = useState('articles');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Users tab state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [promoRequests, setPromoRequests] = useState([]);
  const [roleChanging, setRoleChanging] = useState({}); // { [userId]: bool }
  const [promoNote, setPromoNote] = useState({}); // { [userId]: string }
  const [promoLoading, setPromoLoading] = useState({}); // { [userId]: bool }

  const isRoot = user?.isRoot;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    dashboardApi.get()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  // Load users + promotion requests when that tab is activated
  useEffect(() => {
    if (activeTab !== 'users' || !isAdmin) return;
    setUsersLoading(true);
    Promise.all([
      adminApi.users(),
      adminApi.promotionRequests(),
    ])
      .then(([u, p]) => { setUsers(u); setPromoRequests(p); })
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [activeTab, isAdmin]);

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

  // Root: directly change a user's role
  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Change this user's role to "${newRole}"?`)) return;
    setRoleChanging((r) => ({ ...r, [userId]: true }));
    try {
      const updated = await adminApi.setRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: updated.role } : u));
    } catch (err) {
      alert(err.message);
    } finally {
      setRoleChanging((r) => ({ ...r, [userId]: false }));
    }
  };

  // Non-root admin: submit promotion request for a user
  const handleRequestPromotion = async (targetUserId) => {
    setPromoLoading((p) => ({ ...p, [targetUserId]: true }));
    try {
      await adminApi.requestPromotion(targetUserId, 'admin', promoNote[targetUserId] || '');
      alert('Promotion request submitted. The root administrator will review it.');
      const updated = await adminApi.promotionRequests();
      setPromoRequests(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setPromoLoading((p) => ({ ...p, [targetUserId]: false }));
    }
  };

  // Root: approve or reject a promotion request
  const handleReviewPromo = async (id, action) => {
    try {
      if (action === 'approve') await adminApi.approvePromotion(id);
      else await adminApi.rejectPromotion(id);
      const [updatedUsers, updatedRequests] = await Promise.all([
        adminApi.users(),
        adminApi.promotionRequests(),
      ]);
      setUsers(updatedUsers);
      setPromoRequests(updatedRequests);
    } catch (err) {
      alert(err.message);
    }
  };

  const ROLE_OPTIONS = ['user', 'author', 'admin'];
  const ROLE_LABELS = { user: 'User', author: 'Author', admin: 'Admin' };
  const ROLE_BADGE = {
    user:   { bg: '#f3f4f6', color: '#374151' },
    author: { bg: '#eff6ff', color: '#1d4ed8' },
    admin:  { bg: '#f0fdf4', color: '#15803d' },
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
            <button
              className={`dashboard-tab${activeTab === 'users' ? ' active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users {isRoot && promoRequests.filter((r) => r.status === 'pending').length > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '0.7rem', padding: '0 5px', marginLeft: '4px' }}>
                  {promoRequests.filter((r) => r.status === 'pending').length}
                </span>
              )}
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
          {activeTab === 'users' && (
            <div id="users-panel">
              {usersLoading ? (
                <p style={{ padding: '1rem 0', color: 'var(--black-mid)' }}>Loading users…</p>
              ) : (
                <>
                  {/* Pending promotion requests — root only */}
                  {isRoot && promoRequests.filter((r) => r.status === 'pending').length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--lb-blue-dark)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Pending Promotion Requests
                      </h3>
                      {promoRequests.filter((r) => r.status === 'pending').map((req) => {
                        const target = users.find((u) => u.id === req.targetUserId);
                        const requester = users.find((u) => u.id === req.requesterId);
                        return (
                          <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', marginBottom: '0.5rem' }}>
                            <div style={{ flex: 1, fontSize: '0.875rem' }}>
                              <strong>{target?.displayName || req.targetUserId}</strong>
                              <span style={{ color: 'var(--black-mid)', marginLeft: '0.4rem' }}>→ {req.requestedRole}</span>
                              <span style={{ color: '#9ca3af', marginLeft: '0.5rem' }}>· requested by {requester?.displayName || req.requesterId}</span>
                              {req.note && <span style={{ display: 'block', color: 'var(--black-mid)', marginTop: '0.2rem' }}>{req.note}</span>}
                            </div>
                            <button className="btn btn-ghost btn-sm" style={{ color: '#15803d', borderColor: '#86efac' }} onClick={() => handleReviewPromo(req.id, 'approve')}>Approve</button>
                            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleReviewPromo(req.id, 'reject')}>Reject</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* User table */}
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const badge = ROLE_BADGE[u.role] || ROLE_BADGE.user;
                        const isSelf = u.id === user?.id;
                        const alreadyRequested = promoRequests.some(
                          (r) => r.targetUserId === u.id && r.status === 'pending'
                        );
                        return (
                          <tr key={u.id}>
                            <td className="title-cell">
                              {u.displayName}
                              {u.isRoot && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '999px' }}>root</span>}
                              {isSelf && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#9ca3af' }}>(you)</span>}
                            </td>
                            <td className="meta-cell">{u.email || '—'}</td>
                            <td className="meta-cell">
                              <span style={{ background: badge.bg, color: badge.color, padding: '2px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                            </td>
                            <td>
                              <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                                {/* Root: direct role selector */}
                                {isRoot && !u.isRoot && !isSelf && (
                                  <select
                                    value={u.role}
                                    disabled={roleChanging[u.id]}
                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                    style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', borderRadius: '0.4rem', border: '1px solid var(--gray-dark)', cursor: 'pointer' }}
                                  >
                                    {ROLE_OPTIONS.map((r) => (
                                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                    ))}
                                  </select>
                                )}
                                {/* Non-root admin: request promotion for user/author roles */}
                                {!isRoot && !isSelf && !u.isRoot && u.role !== 'admin' && (
                                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    {alreadyRequested ? (
                                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Request pending…</span>
                                    ) : (
                                      <>
                                        <input
                                          type="text"
                                          placeholder="Reason (optional)"
                                          value={promoNote[u.id] || ''}
                                          onChange={(e) => setPromoNote((n) => ({ ...n, [u.id]: e.target.value }))}
                                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', border: '1px solid var(--gray-dark)', borderRadius: '0.4rem', width: '140px' }}
                                        />
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          disabled={promoLoading[u.id]}
                                          onClick={() => handleRequestPromotion(u.id)}
                                        >
                                          {promoLoading[u.id] ? '…' : 'Promote'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {users.length === 0 && (
                        <tr><td colSpan={4} className="dashboard-empty">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </section>
    </>
  );
}

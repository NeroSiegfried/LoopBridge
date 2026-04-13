import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { coursesApi, uploadsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/edit-course.css';

export default function EditCourse() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState({
    title: '', level: '', description: '', duration: '', overview: '', image: '',
  });
  const [objectives, setObjectives] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!isNew) {
      coursesApi.get(id)
        .then((data) => {
          setForm({
            title: data.title || '',
            level: data.level || '',
            description: data.description || '',
            duration: data.duration || '',
            overview: data.overview || '',
            image: data.image || '',
          });
          setObjectives(data.learningOutcomes || []);
          setTopics(data.topics || data.sections || []);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const addObjective = () => setObjectives((o) => [...o, '']);
  const updateObjective = (idx, val) => setObjectives((o) => o.map((v, i) => i === idx ? val : v));
  const removeObjective = (idx) => setObjectives((o) => o.filter((_, i) => i !== idx));

  const addTopic = () => setTopics((t) => [...t, { title: '', subsections: [] }]);
  const updateTopicTitle = (idx, title) => setTopics((t) => t.map((tp, i) => i === idx ? { ...tp, title } : tp));
  const removeTopic = (idx) => setTopics((t) => t.filter((_, i) => i !== idx));

  const addSubsection = (tIdx) => {
    setTopics((t) => t.map((tp, i) => i === tIdx
      ? { ...tp, subsections: [...(tp.subsections || []), { title: '', duration: '' }] }
      : tp
    ));
  };
  const updateSubsection = (tIdx, sIdx, field, value) => {
    setTopics((t) => t.map((tp, i) => i === tIdx
      ? { ...tp, subsections: tp.subsections.map((s, j) => j === sIdx ? { ...s, [field]: value } : s) }
      : tp
    ));
  };
  const removeSubsection = (tIdx, sIdx) => {
    setTopics((t) => t.map((tp, i) => i === tIdx
      ? { ...tp, subsections: tp.subsections.filter((_, j) => j !== sIdx) }
      : tp
    ));
  };

  const totalVideos = topics.reduce((sum, t) => sum + (t.subsections?.length || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, learningOutcomes: objectives, topics };
      if (isNew) {
        await coursesApi.create(payload);
      } else {
        await coursesApi.update(id, payload);
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="editor-body"><p>Loading…</p></div>;

  return (
    <>
      <SEO title={`${isNew ? 'New' : 'Edit'} Course — LoopBridge Admin`} />

      <div className="editor-action-bar">
        <div className="bar-inner">
          <Link to="/admin/dashboard" className="btn btn-ghost btn-sm">
            <i className="fa-solid fa-arrow-left" /> Dashboard
          </Link>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-body">
        <div className="editor-header">
          <h1 id="editor-title">{isNew ? 'New Course' : 'Edit Course'}</h1>
        </div>

        {error && <div className="login-error" style={{ display: 'block', marginBottom: '1rem' }}>{error}</div>}

        <div className="course-stats" id="course-stats">
          <div className="course-stat">
            <i className="fa-solid fa-book-open" />
            <span className="stat-val" id="stat-topics">{topics.length}</span> Topics
          </div>
          <div className="course-stat">
            <i className="fa-solid fa-play-circle" />
            <span className="stat-val" id="stat-videos">{totalVideos}</span> Videos
          </div>
          <div className="course-stat">
            <i className="fa-solid fa-clipboard-question" />
            <span className="stat-val" id="stat-quizzes">0</span> Quizzes
          </div>
          <div className="course-stat">
            <i className="fa-solid fa-list-check" />
            <span className="stat-val" id="stat-lessons">{totalVideos}</span> Lessons
          </div>
        </div>

        <form className="editor-form" id="course-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="title">Course Title *</label>
            <input className="input" type="text" id="title" name="title" placeholder="Enter course title" required value={form.title} onChange={handleChange} />
          </div>

          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label" htmlFor="track">Track *</label>
              <select className="input" id="track" name="level" required value={form.level} onChange={handleChange}>
                <option value="">Select track</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="duration">Duration</label>
              <input className="input" type="text" id="duration" name="duration" placeholder="e.g. 4 hours" value={form.duration} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="author">Instructor</label>
              <input className="input" type="text" id="author" name="author" placeholder="Instructor name" readOnly style={{ background: 'var(--gray-light)', cursor: 'default' }} value={user?.displayName || user?.username || ''} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea className="input textarea" id="description" name="description" rows="3" placeholder="Course description" value={form.description} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Learning Objectives</label>
            <div className="objectives-list" id="objectives-list">
              {objectives.map((obj, idx) => (
                <div className="objective-item" key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input className="input" type="text" value={obj} onChange={(e) => updateObjective(idx, e.target.value)} placeholder="Learning objective" />
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeObjective(idx)}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-sm btn-ghost" id="add-objective" onClick={addObjective} style={{ marginTop: '0.5rem' }}>
              <i className="fa-solid fa-plus" /> Add Objective
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Topics &amp; Lessons</label>
            <div className="topics-editor" id="topics-editor">
              {topics.map((topic, tIdx) => (
                <div className="topic-block" key={tIdx} style={{ border: '1px solid var(--gray-mid, #e8ebef)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input className="input" type="text" value={topic.title} onChange={(e) => updateTopicTitle(tIdx, e.target.value)} placeholder={`Topic ${tIdx + 1} title`} />
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeTopic(tIdx)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                  {(topic.subsections || []).map((sub, sIdx) => (
                    <div key={sIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', paddingLeft: '1rem' }}>
                      <input className="input" type="text" value={sub.title} onChange={(e) => updateSubsection(tIdx, sIdx, 'title', e.target.value)} placeholder="Lesson title" style={{ flex: 2 }} />
                      <input className="input" type="text" value={sub.duration || ''} onChange={(e) => updateSubsection(tIdx, sIdx, 'duration', e.target.value)} placeholder="Duration" style={{ flex: 1 }} />
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeSubsection(tIdx, sIdx)}>
                        <i className="fa-solid fa-times" />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => addSubsection(tIdx)} style={{ marginLeft: '1rem' }}>
                    <i className="fa-solid fa-plus" /> Add Lesson
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-sm btn-ghost" id="add-topic" onClick={addTopic} style={{ marginTop: '0.75rem' }}>
              <i className="fa-solid fa-plus" /> Add Topic
            </button>
          </div>

          <div className="editor-actions">
            <button type="submit" className="btn btn-primary" id="save-btn" disabled={saving}>
              <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Save Course'}
            </button>
            <Link to="/admin/dashboard" className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}

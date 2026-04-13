import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { coursesApi, uploadsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/edit-course.css';

/* ── tiny helpers ── */
const uid = () => Math.random().toString(36).slice(2, 9);
const emptyQuestion = () => ({ id: uid(), question: '', options: ['', '', '', ''], correct: 0 });
const emptySubsection = () => ({
  id: uid(),
  title: '',
  duration: '',
  type: 'video',
  videoUrl: '',
  videoFile: null,       // uploading indicator
  hlsUrl: '',
  thumbnailUrl: '',
  content: [],           // reading blocks
  quiz: [],              // quiz questions
  quizTiming: 'end',     // 'end' | 'inline'
  quizTimestamp: '',      // e.g. "1:30"
});
const emptyTopic = () => ({ id: uid(), title: '', subsections: [] });

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
  const [expandedSub, setExpandedSub] = useState(null); // "tIdx-sIdx"

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!isNew) {
      coursesApi.get(id)
        .then((data) => {
          setForm({
            title: data.title || '',
            level: data.level || data.track || '',
            description: data.description || '',
            duration: data.duration || '',
            overview: data.overview || '',
            image: data.image || '',
          });
          setObjectives(data.learningObjectives || data.learningOutcomes || data.objectives || []);
          // Hydrate topics — give each subsection an id
          const hydrated = (data.topics || data.sections || []).map(t => ({
            ...t,
            id: t.id || uid(),
            subsections: (t.subsections || []).map(s => ({
              ...emptySubsection(),
              ...s,
              id: s.id || uid(),
              quiz: (s.quiz || []).map(q => ({ ...emptyQuestion(), ...q, id: q.id || uid() })),
            })),
          }));
          setTopics(hydrated);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, user, navigate]);

  /* ── form helpers ── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  /* ── objectives ── */
  const addObjective = () => setObjectives((o) => [...o, '']);
  const updateObjective = (idx, val) => setObjectives((o) => o.map((v, i) => i === idx ? val : v));
  const removeObjective = (idx) => setObjectives((o) => o.filter((_, i) => i !== idx));

  /* ── topics ── */
  const addTopic = () => setTopics((t) => [...t, emptyTopic()]);
  const updateTopicTitle = (idx, title) => setTopics((t) => t.map((tp, i) => i === idx ? { ...tp, title } : tp));
  const removeTopic = (idx) => setTopics((t) => t.filter((_, i) => i !== idx));

  /* ── subsection CRUD ── */
  const addSubsection = (tIdx) => {
    setTopics((t) => t.map((tp, i) => i === tIdx
      ? { ...tp, subsections: [...(tp.subsections || []), emptySubsection()] }
      : tp
    ));
  };

  const updateSub = (tIdx, sIdx, patch) => {
    setTopics((t) => t.map((tp, i) => i === tIdx
      ? { ...tp, subsections: tp.subsections.map((s, j) => j === sIdx ? { ...s, ...patch } : s) }
      : tp
    ));
  };

  const removeSub = (tIdx, sIdx) => {
    setTopics((t) => t.map((tp, i) => i === tIdx
      ? { ...tp, subsections: tp.subsections.filter((_, j) => j !== sIdx) }
      : tp
    ));
    if (expandedSub === `${tIdx}-${sIdx}`) setExpandedSub(null);
  };

  /* ── video upload ── */
  const handleVideoUpload = async (tIdx, sIdx, file) => {
    updateSub(tIdx, sIdx, { videoFile: `Uploading ${file.name}…` });
    const fd = new FormData();
    fd.append('files', file);
    try {
      const data = await uploadsApi.upload(fd);
      updateSub(tIdx, sIdx, {
        videoUrl: data.url || data.path,
        hlsUrl: data.hlsUrl || '',
        thumbnailUrl: data.thumbnailUrl || '',
        videoFile: file.name,
      });
    } catch (err) {
      console.error('[EditCourse] Video upload failed:', err);
      setError(`Video upload failed: ${err.message}`);
      updateSub(tIdx, sIdx, { videoFile: `Upload failed — ${file.name}` });
    }
  };

  /* ── reading content blocks ── */
  const addContentBlock = (tIdx, sIdx, type) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { content: [...(sub.content || []), { type, value: '' }] });
  };
  const updateContentBlock = (tIdx, sIdx, bIdx, value) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      content: sub.content.map((b, i) => i === bIdx ? { ...b, value } : b),
    });
  };
  const removeContentBlock = (tIdx, sIdx, bIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { content: sub.content.filter((_, i) => i !== bIdx) });
  };

  /* ── quiz CRUD ── */
  const addQuizQuestion = (tIdx, sIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { quiz: [...(sub.quiz || []), emptyQuestion()] });
  };
  const updateQuizQuestion = (tIdx, sIdx, qIdx, patch) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      quiz: sub.quiz.map((q, i) => i === qIdx ? { ...q, ...patch } : q),
    });
  };
  const removeQuizQuestion = (tIdx, sIdx, qIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { quiz: sub.quiz.filter((_, i) => i !== qIdx) });
  };
  const updateQuizOption = (tIdx, sIdx, qIdx, oIdx, value) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.quiz[qIdx];
    const options = q.options.map((o, i) => i === oIdx ? value : o);
    updateQuizQuestion(tIdx, sIdx, qIdx, { options });
  };
  const addQuizOption = (tIdx, sIdx, qIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.quiz[qIdx];
    updateQuizQuestion(tIdx, sIdx, qIdx, { options: [...q.options, ''] });
  };
  const removeQuizOption = (tIdx, sIdx, qIdx, oIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.quiz[qIdx];
    updateQuizQuestion(tIdx, sIdx, qIdx, {
      options: q.options.filter((_, i) => i !== oIdx),
      correct: q.correct >= oIdx && q.correct > 0 ? q.correct - 1 : q.correct,
    });
  };

  /* ── stats ── */
  const stats = topics.reduce(
    (acc, t) => {
      (t.subsections || []).forEach((s) => {
        acc.lessons++;
        if (s.type === 'video') acc.videos++;
        if (s.quiz?.length > 0) acc.quizzes++;
      });
      return acc;
    },
    { lessons: 0, videos: 0, quizzes: 0 },
  );

  /* ── save ── */
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        track: form.level,
        slug: form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        learningObjectives: objectives,
        topics: topics.map(t => ({
          title: t.title,
          subsections: t.subsections.map(s => {
            const out = {
              title: s.title,
              type: s.type,
              duration: s.duration,
            };
            if (s.type === 'video') {
              out.videoUrl = s.videoUrl;
              out.hlsUrl = s.hlsUrl;
              out.thumbnailUrl = s.thumbnailUrl;
            }
            if (s.type === 'reading' || s.type === 'exercise') {
              out.content = s.content;
            }
            if (s.quiz?.length > 0) {
              out.quiz = s.quiz.map(q => ({
                question: q.question,
                options: q.options,
                correct: q.correct,
              }));
              out.quizTiming = s.quizTiming;
              if (s.quizTiming === 'inline') out.quizTimestamp = s.quizTimestamp;
            }
            return out;
          }),
        })),
      };
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

        {/* Stats bar */}
        <div className="course-stats" id="course-stats">
          <div className="course-stat">
            <i className="fa-solid fa-book-open" />
            <span className="stat-val">{topics.length}</span> Topics
          </div>
          <div className="course-stat">
            <i className="fa-solid fa-play-circle" />
            <span className="stat-val">{stats.videos}</span> Videos
          </div>
          <div className="course-stat">
            <i className="fa-solid fa-clipboard-question" />
            <span className="stat-val">{stats.quizzes}</span> Quizzes
          </div>
          <div className="course-stat">
            <i className="fa-solid fa-list-check" />
            <span className="stat-val">{stats.lessons}</span> Lessons
          </div>
        </div>

        <form className="editor-form" id="course-form" onSubmit={handleSubmit}>
          {/* ── Basic info ── */}
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

          {/* ── Objectives ── */}
          <div className="form-group">
            <label className="form-label">Learning Objectives</label>
            <div className="objectives-list" id="objectives-list">
              {objectives.map((obj, idx) => (
                <div className="objective-row" key={idx}>
                  <input className="input" type="text" value={obj} onChange={(e) => updateObjective(idx, e.target.value)} placeholder="Learning objective" />
                  <button type="button" onClick={() => removeObjective(idx)} title="Remove">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addObjective} style={{ marginTop: '0.5rem' }}>
              <i className="fa-solid fa-plus" /> Add Objective
            </button>
          </div>

          {/* ── Topics & Lessons ── */}
          <div className="form-group">
            <label className="form-label">Topics &amp; Lessons</label>
            <div className="topics-editor" id="topics-editor">
              {topics.map((topic, tIdx) => (
                <div className="topic-block" key={topic.id}>
                  <div className="topic-header">
                    <input className="input" type="text" value={topic.title} onChange={(e) => updateTopicTitle(tIdx, e.target.value)} placeholder={`Topic ${tIdx + 1} title`} />
                    <div className="topic-badges">
                      <span className="topic-badge videos">
                        {(topic.subsections || []).filter(s => s.type === 'video').length} video{(topic.subsections || []).filter(s => s.type === 'video').length !== 1 ? 's' : ''}
                      </span>
                      <span className="topic-badge quizzes">
                        {(topic.subsections || []).filter(s => s.quiz?.length > 0).length} quiz{(topic.subsections || []).filter(s => s.quiz?.length > 0).length !== 1 ? 'zes' : ''}
                      </span>
                    </div>
                    <button type="button" onClick={() => removeTopic(tIdx)} title="Remove topic">
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>

                  <div className="topic-subsections">
                    {(topic.subsections || []).map((sub, sIdx) => {
                      const subKey = `${tIdx}-${sIdx}`;
                      const isExpanded = expandedSub === subKey;
                      return (
                        <div className="subsection-row" key={sub.id}>
                          {/* Top row: title, duration, type, expand/collapse, remove */}
                          <div className="sub-top-row">
                            <input className="input" type="text" value={sub.title} onChange={(e) => updateSub(tIdx, sIdx, { title: e.target.value })} placeholder="Lesson title" />
                            <input className="input" type="text" value={sub.duration || ''} onChange={(e) => updateSub(tIdx, sIdx, { duration: e.target.value })} placeholder="5 min" />
                            <select className="input" value={sub.type} onChange={(e) => updateSub(tIdx, sIdx, { type: e.target.value })}>
                              <option value="video">Video</option>
                              <option value="reading">Reading</option>
                              <option value="exercise">Exercise</option>
                            </select>
                            <button type="button" onClick={() => setExpandedSub(isExpanded ? null : subKey)} title={isExpanded ? 'Collapse' : 'Expand'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lb-blue-text)', fontSize: '0.75rem', padding: '0.25rem' }}>
                              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} />
                            </button>
                            <button type="button" onClick={() => removeSub(tIdx, sIdx)} title="Remove">
                              <i className="fa-solid fa-xmark" />
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="sub-expanded">
                              {/* ── Video upload (type=video) ── */}
                              {sub.type === 'video' && (
                                <div className="video-upload-area">
                                  <label>
                                    <i className="fa-solid fa-cloud-arrow-up" />
                                    {' '}Choose video file…
                                    <input
                                      type="file"
                                      accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        if (e.target.files[0]) handleVideoUpload(tIdx, sIdx, e.target.files[0]);
                                      }}
                                    />
                                  </label>
                                  <div className="video-filename">
                                    {sub.videoFile || (sub.videoUrl ? sub.videoUrl.split('/').pop() : 'No file selected')}
                                  </div>
                                  {sub.videoUrl && (
                                    <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--lb-green)' }}>
                                      <i className="fa-solid fa-check-circle" /> Video uploaded
                                      {sub.hlsUrl && <span style={{ marginLeft: '0.5rem' }}><i className="fa-solid fa-film" /> HLS ready</span>}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Reading / Exercise content blocks ── */}
                              {(sub.type === 'reading' || sub.type === 'exercise') && (
                                <div className="reading-content-editor" style={{ marginTop: '0.5rem' }}>
                                  <div className="content-blocks-list">
                                    {(sub.content || []).map((block, bIdx) => (
                                      <div className="content-block-row" key={bIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                                        <span className="block-type-badge" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', background: 'var(--gray-light)', border: '1px solid var(--gray-mid)', whiteSpace: 'nowrap', marginTop: '0.5rem' }}>
                                          {block.type}
                                        </span>
                                        <textarea
                                          className="input textarea"
                                          rows={block.type === 'heading' ? 1 : 3}
                                          value={block.value}
                                          onChange={(e) => updateContentBlock(tIdx, sIdx, bIdx, e.target.value)}
                                          placeholder={`${block.type} content…`}
                                          style={{ flex: 1, fontSize: '0.8125rem' }}
                                        />
                                        <button type="button" onClick={() => removeContentBlock(tIdx, sIdx, bIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--black-mid)', padding: '0.5rem 0.25rem' }}>
                                          <i className="fa-solid fa-xmark" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="add-content-blocks" style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                    {['heading', 'text', 'image', 'code', 'note', 'list'].map((bt) => (
                                      <button key={bt} type="button" className="btn btn-sm btn-ghost" onClick={() => addContentBlock(tIdx, sIdx, bt)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                        <i className={`fa-solid fa-${bt === 'heading' ? 'heading' : bt === 'text' ? 'paragraph' : bt === 'image' ? 'image' : bt === 'code' ? 'code' : bt === 'note' ? 'sticky-note' : 'list'}`} /> {bt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ── Quiz builder ── */}
                              <div className="quiz-builder">
                                <div className="quiz-builder-header">
                                  <span><i className="fa-solid fa-clipboard-question" /> Quiz (optional)</span>
                                  <button type="button" className="btn btn-sm btn-ghost add-question-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addQuizQuestion(tIdx, sIdx)}>
                                    <i className="fa-solid fa-plus" /> Question
                                  </button>
                                </div>

                                <div className="quiz-timing">
                                  <label>Timing:</label>
                                  <select value={sub.quizTiming || 'end'} onChange={(e) => updateSub(tIdx, sIdx, { quizTiming: e.target.value })}>
                                    <option value="end">After lesson</option>
                                    <option value="inline">In-video (pauses video)</option>
                                  </select>
                                  {sub.quizTiming === 'inline' && (
                                    <>
                                      <span className="inline-time-label">at</span>
                                      <input
                                        className="input"
                                        type="text"
                                        value={sub.quizTimestamp || ''}
                                        onChange={(e) => updateSub(tIdx, sIdx, { quizTimestamp: e.target.value })}
                                        placeholder="1:30"
                                        style={{ width: '4rem' }}
                                      />
                                    </>
                                  )}
                                </div>

                                <div className="quiz-questions">
                                  {(sub.quiz || []).map((q, qIdx) => (
                                    <div className="quiz-question" key={q.id}>
                                      <input
                                        className="input question-input"
                                        type="text"
                                        value={q.question}
                                        onChange={(e) => updateQuizQuestion(tIdx, sIdx, qIdx, { question: e.target.value })}
                                        placeholder="Question text"
                                      />
                                      <div className="quiz-options">
                                        {q.options.map((opt, oIdx) => (
                                          <div className="quiz-option" key={oIdx}>
                                            <input
                                              type="radio"
                                              name={`q-${sub.id}-${qIdx}`}
                                              checked={q.correct === oIdx}
                                              onChange={() => updateQuizQuestion(tIdx, sIdx, qIdx, { correct: oIdx })}
                                            />
                                            <input
                                              className="input"
                                              type="text"
                                              value={opt}
                                              onChange={(e) => updateQuizOption(tIdx, sIdx, qIdx, oIdx, e.target.value)}
                                              placeholder={`Option ${oIdx + 1}`}
                                            />
                                            <button type="button" className="remove-option" onClick={() => removeQuizOption(tIdx, sIdx, qIdx, oIdx)} title="Remove option">
                                              <i className="fa-solid fa-xmark" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="quiz-question-actions">
                                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => addQuizOption(tIdx, sIdx, qIdx)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                          <i className="fa-solid fa-plus" /> Option
                                        </button>
                                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeQuizQuestion(tIdx, sIdx, qIdx)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', color: '#e53e3e' }}>
                                          <i className="fa-solid fa-trash" /> Remove
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button type="button" className="btn btn-sm btn-ghost add-subsection-btn" onClick={() => addSubsection(tIdx)}>
                    <i className="fa-solid fa-plus" /> Add Lesson
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={addTopic} style={{ marginTop: '0.75rem' }}>
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

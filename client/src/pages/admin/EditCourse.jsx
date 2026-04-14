import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { coursesApi, uploadsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/edit-course.css';

/* ── tiny helpers ── */
const uid = () => Math.random().toString(36).slice(2, 9);
const emptyQuestion = () => ({ id: uid(), question: '', options: ['', '', '', ''], correctIndex: 0 });
const emptySubsection = () => ({
  id: uid(),
  title: '',
  duration: '',
  type: 'video',
  videoUrl: '',
  uploadState: null,     // null | 'uploading' | 'processing' | 'done' | 'error'
  uploadProgress: 0,     // 0-100
  uploadError: '',
  uploadId: '',
  hlsUrl: '',
  thumbnailUrl: '',
  content: [],           // content blocks — available for ALL lesson types
  quizPoints: [],        // inline quiz pause-points: [{ atSeconds, questions }]
  endQuiz: [],           // end-of-lesson quiz questions
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
  const [uploadingCount, setUploadingCount] = useState(0); // number of active uploads

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
          // Hydrate topics — give each subsection an id and normalize quiz format
          const hydrated = (data.topics || data.sections || []).map(t => ({
            ...t,
            id: t.id || uid(),
            subsections: (t.subsections || []).map(s => ({
              ...emptySubsection(),
              ...s,
              id: s.id || uid(),
              uploadState: (s.videoUrl || s.hlsUrl) ? 'done' : null,
              // Normalize quiz: support both old format (quiz/quizTiming) and new (quizPoints/endQuiz)
              quizPoints: (s.quizPoints || []).map(qp => ({
                ...qp,
                questions: (qp.questions || []).map(q => ({ ...emptyQuestion(), ...q, id: q.id || uid() })),
              })),
              endQuiz: (s.endQuiz || s.quiz || []).map(q => ({ ...emptyQuestion(), ...q, id: q.id || uid() })),
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

  /* ── video upload with progress ── */
  const handleVideoUpload = async (tIdx, sIdx, file) => {
    setUploadingCount(c => c + 1);
    updateSub(tIdx, sIdx, { uploadState: 'uploading', uploadProgress: 0, uploadError: '' });

    const fd = new FormData();
    fd.append('files', file);

    try {
      // Use XMLHttpRequest for upload progress
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/uploads');
        xhr.withCredentials = true;

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            updateSub(tIdx, sIdx, { uploadProgress: pct });
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
      });

      // Upload done — video is now on S3 / disk, transcoding may be in progress
      updateSub(tIdx, sIdx, {
        videoUrl: data.url || data.path,
        hlsUrl: data.hlsUrl || '',
        thumbnailUrl: data.thumbnailUrl || '',
        uploadId: data.id || '',
        uploadState: data.hlsUrl ? 'done' : 'processing',
        uploadProgress: 100,
      });

      // If no HLS URL yet, start polling for transcode completion
      if (!data.hlsUrl && data.id) {
        pollTranscodeStatus(tIdx, sIdx, data.id);
      }
    } catch (err) {
      console.error('[EditCourse] Video upload failed:', err);
      setError(`Video upload failed: ${err.message}`);
      updateSub(tIdx, sIdx, { uploadState: 'error', uploadError: err.message });
    } finally {
      setUploadingCount(c => Math.max(0, c - 1));
    }
  };

  /* ── poll transcode status ── */
  const pollTranscodeStatus = async (tIdx, sIdx, uploadId) => {
    const maxAttempts = 120; // 10 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000)); // poll every 5s
      try {
        const resp = await fetch(`/api/transcode/${uploadId}/status`, { credentials: 'include' });
        if (!resp.ok) continue;
        const status = await resp.json();
        if (status.status === 'COMPLETE' || status.status === 'complete') {
          updateSub(tIdx, sIdx, {
            hlsUrl: status.hlsUrl || '',
            thumbnailUrl: status.thumbnailUrl || '',
            uploadState: 'done',
          });
          return;
        }
        if (status.status === 'ERROR' || status.status === 'error') {
          updateSub(tIdx, sIdx, { uploadState: 'done' }); // still usable as mp4
          return;
        }
      } catch { /* keep polling */ }
    }
    // Timeout — just mark as done (mp4 is still usable)
    updateSub(tIdx, sIdx, { uploadState: 'done' });
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

  /* ── quiz CRUD (end-of-lesson quiz) ── */
  const addEndQuizQuestion = (tIdx, sIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { endQuiz: [...(sub.endQuiz || []), emptyQuestion()] });
  };
  const updateEndQuizQuestion = (tIdx, sIdx, qIdx, patch) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      endQuiz: sub.endQuiz.map((q, i) => i === qIdx ? { ...q, ...patch } : q),
    });
  };
  const removeEndQuizQuestion = (tIdx, sIdx, qIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { endQuiz: sub.endQuiz.filter((_, i) => i !== qIdx) });
  };
  const updateEndQuizOption = (tIdx, sIdx, qIdx, oIdx, value) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.endQuiz[qIdx];
    const options = q.options.map((o, i) => i === oIdx ? value : o);
    updateEndQuizQuestion(tIdx, sIdx, qIdx, { options });
  };
  const addEndQuizOption = (tIdx, sIdx, qIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.endQuiz[qIdx];
    updateEndQuizQuestion(tIdx, sIdx, qIdx, { options: [...q.options, ''] });
  };
  const removeEndQuizOption = (tIdx, sIdx, qIdx, oIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.endQuiz[qIdx];
    updateEndQuizQuestion(tIdx, sIdx, qIdx, {
      options: q.options.filter((_, i) => i !== oIdx),
      correctIndex: q.correctIndex >= oIdx && q.correctIndex > 0 ? q.correctIndex - 1 : q.correctIndex,
    });
  };

  /* ── inline quiz pause-points ── */
  const addQuizPoint = (tIdx, sIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      quizPoints: [...(sub.quizPoints || []), { atTimestamp: '', atSeconds: 0, questions: [emptyQuestion()] }],
    });
  };
  const removeQuizPoint = (tIdx, sIdx, pIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, { quizPoints: sub.quizPoints.filter((_, i) => i !== pIdx) });
  };
  const updateQuizPointTimestamp = (tIdx, sIdx, pIdx, ts) => {
    const sub = topics[tIdx].subsections[sIdx];
    // Parse "1:30" → 90 seconds
    const parts = ts.split(':').map(Number);
    const secs = parts.length === 2 ? (parts[0] || 0) * 60 + (parts[1] || 0) : (parts[0] || 0);
    updateSub(tIdx, sIdx, {
      quizPoints: sub.quizPoints.map((p, i) => i === pIdx ? { ...p, atTimestamp: ts, atSeconds: secs } : p),
    });
  };
  const addQuizPointQuestion = (tIdx, sIdx, pIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      quizPoints: sub.quizPoints.map((p, i) => i === pIdx ? { ...p, questions: [...p.questions, emptyQuestion()] } : p),
    });
  };
  const updateQuizPointQuestion = (tIdx, sIdx, pIdx, qIdx, patch) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      quizPoints: sub.quizPoints.map((p, i) => i === pIdx ? {
        ...p, questions: p.questions.map((q, j) => j === qIdx ? { ...q, ...patch } : q),
      } : p),
    });
  };
  const removeQuizPointQuestion = (tIdx, sIdx, pIdx, qIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    updateSub(tIdx, sIdx, {
      quizPoints: sub.quizPoints.map((p, i) => i === pIdx ? {
        ...p, questions: p.questions.filter((_, j) => j !== qIdx),
      } : p),
    });
  };
  const updateQPOption = (tIdx, sIdx, pIdx, qIdx, oIdx, value) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.quizPoints[pIdx].questions[qIdx];
    updateQuizPointQuestion(tIdx, sIdx, pIdx, qIdx, { options: q.options.map((o, i) => i === oIdx ? value : o) });
  };
  const addQPOption = (tIdx, sIdx, pIdx, qIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.quizPoints[pIdx].questions[qIdx];
    updateQuizPointQuestion(tIdx, sIdx, pIdx, qIdx, { options: [...q.options, ''] });
  };
  const removeQPOption = (tIdx, sIdx, pIdx, qIdx, oIdx) => {
    const sub = topics[tIdx].subsections[sIdx];
    const q = sub.quizPoints[pIdx].questions[qIdx];
    updateQuizPointQuestion(tIdx, sIdx, pIdx, qIdx, {
      options: q.options.filter((_, i) => i !== oIdx),
      correctIndex: q.correctIndex >= oIdx && q.correctIndex > 0 ? q.correctIndex - 1 : q.correctIndex,
    });
  };

  /* ── stats ── */
  const stats = topics.reduce(
    (acc, t) => {
      (t.subsections || []).forEach((s) => {
        acc.lessons++;
        if (s.type === 'video') acc.videos++;
        if ((s.endQuiz?.length > 0) || (s.quizPoints?.length > 0)) acc.quizzes++;
      });
      return acc;
    },
    { lessons: 0, videos: 0, quizzes: 0 },
  );

  const canSave = uploadingCount === 0;

  /* ── save ── */
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!canSave) return;
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
              content: s.content || [],
            };
            if (s.type === 'video') {
              out.videoUrl = s.videoUrl;
              out.hlsUrl = s.hlsUrl;
              out.thumbnailUrl = s.thumbnailUrl;
              out.uploadId = s.uploadId;
            }
            // Inline quiz pause-points (video only)
            if (s.quizPoints?.length > 0) {
              out.quizPoints = s.quizPoints.map(qp => ({
                atSeconds: qp.atSeconds,
                atTimestamp: qp.atTimestamp,
                questions: qp.questions.map(q => ({
                  question: q.question,
                  options: q.options,
                  correctIndex: q.correctIndex,
                })),
              }));
            }
            // End-of-lesson quiz
            if (s.endQuiz?.length > 0) {
              out.endQuiz = s.endQuiz.map(q => ({
                question: q.question,
                options: q.options,
                correctIndex: q.correctIndex,
              }));
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
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving || !canSave}>
            <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : !canSave ? `Uploading (${uploadingCount})…` : 'Save'}
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
                        {(topic.subsections || []).filter(s => (s.endQuiz?.length > 0) || (s.quizPoints?.length > 0)).length} quiz{(topic.subsections || []).filter(s => (s.endQuiz?.length > 0) || (s.quizPoints?.length > 0)).length !== 1 ? 'zes' : ''}
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
                                  {!sub.uploadState || sub.uploadState === 'error' ? (
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
                                  ) : null}

                                  {sub.uploadState === 'error' && (
                                    <div className="upload-error">
                                      <i className="fa-solid fa-triangle-exclamation" /> {sub.uploadError || 'Upload failed'}
                                    </div>
                                  )}

                                  {sub.uploadState === 'uploading' && (
                                    <div className="upload-progress-area">
                                      <div className="upload-progress-bar">
                                        <div className="upload-progress-fill" style={{ width: `${sub.uploadProgress}%` }} />
                                      </div>
                                      <span className="upload-progress-text">
                                        <i className="fa-solid fa-spinner fa-spin" /> Uploading… {sub.uploadProgress}%
                                      </span>
                                    </div>
                                  )}

                                  {sub.uploadState === 'processing' && (
                                    <div className="upload-processing">
                                      <i className="fa-solid fa-film fa-beat-fade" />
                                      <span>Processing video — creating multiple resolutions for adaptive streaming. You can save now; processing continues in the background.</span>
                                    </div>
                                  )}

                                  {sub.uploadState === 'done' && sub.videoUrl && (
                                    <div className="upload-done">
                                      <i className="fa-solid fa-check-circle" style={{ color: 'var(--lb-green)' }} /> Video uploaded
                                      {sub.hlsUrl && <span style={{ marginLeft: '0.5rem' }}><i className="fa-solid fa-film" /> Adaptive streaming ready</span>}
                                      <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}
                                        onClick={() => updateSub(tIdx, sIdx, { videoUrl: '', hlsUrl: '', thumbnailUrl: '', uploadState: null, uploadProgress: 0 })}>
                                        <i className="fa-solid fa-rotate-left" /> Replace
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Content blocks (available for ALL lesson types) ── */}
                              <div className="reading-content-editor" style={{ marginTop: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--black-mid)' }}>
                                    <i className="fa-solid fa-align-left" /> {sub.type === 'video' ? 'Accompanying Notes' : 'Lesson Content'}
                                  </span>
                                </div>
                                <div className="content-blocks-list">
                                  {(sub.content || []).map((block, bIdx) => (
                                    <div className="content-block-row" key={bIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                                      <span className="block-type-badge" style={{ fontSize: '0.6875rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', background: 'var(--gray-light)', border: '1px solid var(--gray-mid)', whiteSpace: 'nowrap', marginTop: '0.5rem' }}>
                                        {block.type}
                                      </span>
                                      {block.type === 'image' ? (
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                          {block.value && (
                                            <img src={block.value} alt="" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '0.375rem', border: '1px solid var(--gray-mid)' }} />
                                          )}
                                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                            <label className="btn btn-sm btn-ghost" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', cursor: 'pointer', margin: 0 }}>
                                              <i className="fa-solid fa-upload" /> {block.value ? 'Replace' : 'Upload Image'}
                                              <input
                                                type="file"
                                                accept="image/*"
                                                hidden
                                                onChange={async (e) => {
                                                  const file = e.target.files[0];
                                                  if (!file) return;
                                                  updateContentBlock(tIdx, sIdx, bIdx, 'Uploading…');
                                                  try {
                                                    const fd = new FormData();
                                                    fd.append('files', file);
                                                    const data = await uploadsApi.upload(fd);
                                                    updateContentBlock(tIdx, sIdx, bIdx, data.url || data.path);
                                                  } catch {
                                                    updateContentBlock(tIdx, sIdx, bIdx, '');
                                                  }
                                                }}
                                              />
                                            </label>
                                            <input
                                              className="input"
                                              type="text"
                                              value={block.value}
                                              onChange={(e) => updateContentBlock(tIdx, sIdx, bIdx, e.target.value)}
                                              placeholder="…or paste image URL"
                                              style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <textarea
                                          className="input textarea"
                                          rows={block.type === 'heading' ? 1 : 3}
                                          value={block.value}
                                          onChange={(e) => updateContentBlock(tIdx, sIdx, bIdx, e.target.value)}
                                          placeholder={`${block.type} content…`}
                                          style={{ flex: 1, fontSize: '0.8125rem' }}
                                        />
                                      )}
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

                              {/* ── Inline quiz pause-points (video only) ── */}
                              {sub.type === 'video' && (
                                <div className="quiz-builder" style={{ marginTop: '0.75rem' }}>
                                  <div className="quiz-builder-header">
                                    <span><i className="fa-solid fa-pause-circle" /> In-Video Quiz Checkpoints</span>
                                    <button type="button" className="btn btn-sm btn-ghost add-question-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addQuizPoint(tIdx, sIdx)}>
                                      <i className="fa-solid fa-plus" /> Add Checkpoint
                                    </button>
                                  </div>
                                  {(sub.quizPoints || []).length === 0 && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--black-mid)', margin: '0.25rem 0', fontStyle: 'italic' }}>
                                      Pause the video at a specific time and show a quiz the learner must pass to continue.
                                    </p>
                                  )}
                                  {(sub.quizPoints || []).map((point, pIdx) => (
                                    <div key={pIdx} className="quiz-point-block" style={{ background: 'white', border: '1px solid var(--gray-mid)', borderRadius: '0.375rem', padding: '0.625rem', marginBottom: '0.5rem' }}>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--black-mid)' }}>Pause at:</span>
                                        <input className="input" type="text" value={point.atTimestamp || ''} onChange={(e) => updateQuizPointTimestamp(tIdx, sIdx, pIdx, e.target.value)} placeholder="1:30" style={{ width: '5rem', fontSize: '0.8125rem' }} />
                                        <span style={{ fontSize: '0.6875rem', color: 'var(--black-mid)' }}>({point.atSeconds}s)</span>
                                        <button type="button" onClick={() => removeQuizPoint(tIdx, sIdx, pIdx)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#e53e3e', fontSize: '0.75rem' }}>
                                          <i className="fa-solid fa-trash" /> Remove
                                        </button>
                                      </div>
                                      {point.questions.map((q, qIdx) => (
                                        <div key={q.id} className="quiz-question" style={{ marginBottom: '0.375rem' }}>
                                          <input className="input question-input" type="text" value={q.question} onChange={(e) => updateQuizPointQuestion(tIdx, sIdx, pIdx, qIdx, { question: e.target.value })} placeholder="Question text" />
                                          <div className="quiz-options">
                                            {q.options.map((opt, oIdx) => (
                                              <div className="quiz-option" key={oIdx}>
                                                <input type="radio" name={`qp-${sub.id}-${pIdx}-${qIdx}`} checked={q.correctIndex === oIdx} onChange={() => updateQuizPointQuestion(tIdx, sIdx, pIdx, qIdx, { correctIndex: oIdx })} />
                                                <input className="input" type="text" value={opt} onChange={(e) => updateQPOption(tIdx, sIdx, pIdx, qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} />
                                                <button type="button" className="remove-option" onClick={() => removeQPOption(tIdx, sIdx, pIdx, qIdx, oIdx)}><i className="fa-solid fa-xmark" /></button>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="quiz-question-actions">
                                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => addQPOption(tIdx, sIdx, pIdx, qIdx)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}><i className="fa-solid fa-plus" /> Option</button>
                                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeQuizPointQuestion(tIdx, sIdx, pIdx, qIdx)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', color: '#e53e3e' }}><i className="fa-solid fa-trash" /> Remove</button>
                                          </div>
                                        </div>
                                      ))}
                                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => addQuizPointQuestion(tIdx, sIdx, pIdx)} style={{ fontSize: '0.7rem' }}>
                                        <i className="fa-solid fa-plus" /> Add Question
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* ── End-of-lesson quiz ── */}
                              <div className="quiz-builder" style={{ marginTop: '0.75rem' }}>
                                <div className="quiz-builder-header">
                                  <span><i className="fa-solid fa-clipboard-question" /> End-of-Lesson Quiz</span>
                                  <button type="button" className="btn btn-sm btn-ghost add-question-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => addEndQuizQuestion(tIdx, sIdx)}>
                                    <i className="fa-solid fa-plus" /> Question
                                  </button>
                                </div>

                                <div className="quiz-questions">
                                  {(sub.endQuiz || []).map((q, qIdx) => (
                                    <div className="quiz-question" key={q.id}>
                                      <input
                                        className="input question-input"
                                        type="text"
                                        value={q.question}
                                        onChange={(e) => updateEndQuizQuestion(tIdx, sIdx, qIdx, { question: e.target.value })}
                                        placeholder="Question text"
                                      />
                                      <div className="quiz-options">
                                        {q.options.map((opt, oIdx) => (
                                          <div className="quiz-option" key={oIdx}>
                                            <input
                                              type="radio"
                                              name={`eq-${sub.id}-${qIdx}`}
                                              checked={q.correctIndex === oIdx}
                                              onChange={() => updateEndQuizQuestion(tIdx, sIdx, qIdx, { correctIndex: oIdx })}
                                            />
                                            <input
                                              className="input"
                                              type="text"
                                              value={opt}
                                              onChange={(e) => updateEndQuizOption(tIdx, sIdx, qIdx, oIdx, e.target.value)}
                                              placeholder={`Option ${oIdx + 1}`}
                                            />
                                            <button type="button" className="remove-option" onClick={() => removeEndQuizOption(tIdx, sIdx, qIdx, oIdx)} title="Remove option">
                                              <i className="fa-solid fa-xmark" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="quiz-question-actions">
                                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => addEndQuizOption(tIdx, sIdx, qIdx)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                                          <i className="fa-solid fa-plus" /> Option
                                        </button>
                                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeEndQuizQuestion(tIdx, sIdx, qIdx)} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', color: '#e53e3e' }}>
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
            <button type="submit" className="btn btn-primary" id="save-btn" disabled={saving || !canSave}>
              <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : !canSave ? `Uploading (${uploadingCount})…` : 'Save Course'}
            </button>
            <Link to="/admin/dashboard" className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}

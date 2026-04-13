import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { articlesApi, uploadsApi, recommendationsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../styles/edit-article.css';

const BLOCK_TYPES = [
  { type: 'heading', icon: 'fa-heading', label: 'Heading' },
  { type: 'paragraph', icon: 'fa-paragraph', label: 'Paragraph' },
  { type: 'list', icon: 'fa-list', label: 'List' },
  { type: 'blockquote', icon: 'fa-quote-left', label: 'Quote' },
  { type: 'image', icon: 'fa-image', label: 'Image' },
  { type: 'video', icon: 'fa-film', label: 'Video' },
  { type: 'audio', icon: 'fa-headphones', label: 'Audio' },
  { type: 'embed', icon: 'fa-code', label: 'Embed' },
];

const MEDIA_BLOCK_TYPES = new Set(['image', 'video', 'audio']);

export default function EditArticle() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !id;

  const [form, setForm] = useState({
    title: '', category: '', excerpt: '', body: '', image: '', featured: false,
  });
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [coverFilename, setCoverFilename] = useState('Choose an image file…');
  const [suggestedCategories, setSuggestedCategories] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const analyseTimeout = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!isNew) {
      articlesApi.get(id)
        .then((data) => {
          setForm({
            title: data.title || '',
            category: data.category || '',
            excerpt: data.excerpt || '',
            body: data.body || '',
            image: data.image || '',
            featured: data.featured || false,
          });
          if (data.contentBlocks?.length) setBlocks(data.contentBlocks);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, isNew, user, navigate]);

  /* ── AI category suggestion (debounced) ── */
  const triggerAnalyse = useCallback(() => {
    if (analyseTimeout.current) clearTimeout(analyseTimeout.current);
    analyseTimeout.current = setTimeout(async () => {
      const title = form.title.trim();
      const body = form.body?.trim() || form.excerpt?.trim() || '';
      if (!title && !body) return;
      setSuggestLoading(true);
      try {
        const data = await recommendationsApi.analyse({ title, body });
        setSuggestedCategories(data.categories || data);
      } catch { /* ignore */ }
      setSuggestLoading(false);
    }, 800);
  }, [form.title, form.body, form.excerpt]);

  // Re-analyse when title or body changes
  useEffect(() => {
    triggerAnalyse();
    return () => { if (analyseTimeout.current) clearTimeout(analyseTimeout.current); };
  }, [triggerAnalyse]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFilename(file.name);
    const fd = new FormData();
    fd.append('files', file);
    try {
      const data = await uploadsApi.upload(fd);
      setForm((f) => ({ ...f, image: data.url || data.path }));
    } catch (err) {
      console.error('[EditArticle] Image upload failed:', err);
      setError('Image upload failed');
    }
  };

  /* ── Block helpers ── */
  const addBlock = (type) => {
    setBlocks((b) => [...b, { type, content: '' }]);
  };

  const updateBlock = (idx, content) => {
    setBlocks((b) => b.map((bl, i) => i === idx ? { ...bl, content } : bl));
  };

  const removeBlock = (idx) => {
    setBlocks((b) => b.filter((_, i) => i !== idx));
  };

  const handleBlockMediaUpload = async (idx, file) => {
    updateBlock(idx, 'Uploading…');
    const fd = new FormData();
    fd.append('files', file);
    try {
      const data = await uploadsApi.upload(fd);
      updateBlock(idx, data.url || data.path);
    } catch (err) {
      console.error('[EditArticle] Block media upload failed:', err);
      updateBlock(idx, 'Upload failed');
    }
  };

  const applySuggestedCategory = (cat) => {
    const current = form.category.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(cat)) {
      setForm((f) => ({ ...f, category: [...current, cat].join(', ') }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, contentBlocks: blocks };
      if (isNew) {
        await articlesApi.create(payload);
      } else {
        await articlesApi.update(id, payload);
      }
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="editor-layout"><p>Loading…</p></div>;

  return (
    <>
      <SEO title={`${isNew ? 'New' : 'Edit'} Article — LoopBridge Admin`} />

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

      <div className="editor-layout">
        <div className="editor-panel">
          <div className="panel-content">
            <h1 id="editor-title">{isNew ? 'New Article' : 'Edit Article'}</h1>

            {error && <div className="login-error" style={{ display: 'block' }}>{error}</div>}

            <form className="editor-form" id="article-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="title">Title *</label>
                <input className="input" type="text" id="title" name="title" placeholder="Enter article title" required value={form.title} onChange={handleChange} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="category">Categories * <span style={{ fontWeight: 300, fontSize: '0.75rem', color: 'var(--black-mid)' }}>(comma-separated)</span></label>
                  <input className="input" type="text" id="category" name="category" placeholder="DeFi, Bitcoin, Security" required value={form.category} onChange={handleChange} />
                  {/* AI category suggestions */}
                  {(suggestLoading || suggestedCategories) && (
                    <div className="ai-category-panel" style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--gray-light, #f7f8fa)', border: '1px solid var(--gray-mid, #e8ebef)', borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--lb-blue-text)', marginRight: '0.5rem' }}>
                        <i className="fa-solid fa-wand-magic-sparkles" /> AI Suggests:
                      </span>
                      {suggestLoading ? (
                        <span style={{ color: 'var(--black-mid)' }}>Analysing…</span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                          {(Array.isArray(suggestedCategories) ? suggestedCategories : []).slice(0, 5).map((cat, idx) => {
                            const name = typeof cat === 'string' ? cat : cat.category || cat.name;
                            const score = typeof cat === 'object' ? cat.score : null;
                            return (
                              <button
                                key={idx}
                                type="button"
                                className="btn btn-sm btn-ghost"
                                onClick={() => applySuggestedCategory(name)}
                                style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--gray-dark, #e8ebef)', borderRadius: '1rem' }}
                              >
                                {name}{score != null ? ` (${Math.round(score)}%)` : ''}
                              </button>
                            );
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="author-name">Author</label>
                  <input className="input" type="text" id="author-name" name="author-name" placeholder="Author name" readOnly style={{ background: 'var(--gray-light)', cursor: 'default' }} value={user?.displayName || user?.username || ''} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="excerpt">Excerpt / Description</label>
                <textarea className="input textarea" id="excerpt" name="excerpt" rows="2" placeholder="Brief summary of the article" value={form.excerpt} onChange={handleChange} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cover-upload">Cover Image</label>
                <div className="file-upload-area">
                  <label className="file-upload-label">
                    <i className="fa-solid fa-cloud-arrow-up" />
                    <span id="cover-filename">{coverFilename}</span>
                    <input type="file" id="cover-upload" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="form-group" id="featured-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="featured" name="featured" checked={form.featured} onChange={handleChange} />
                <label className="form-label" htmlFor="featured" style={{ margin: 0 }}>Featured article</label>
              </div>

              <div className="form-group">
                <label className="form-label">Content (HTML)</label>
                <textarea className="input textarea" name="body" rows="12" placeholder="Write article content in HTML…" value={form.body} onChange={handleChange} style={{ minHeight: '300px', fontFamily: 'monospace' }} />
              </div>

              <div className="form-group">
                <label className="form-label">Content Blocks</label>
                <div className="content-blocks" id="content-blocks">
                  {blocks.map((block, idx) => (
                    <div className="content-block" key={idx}>
                      <div className="block-header">
                        <span className="block-type">{block.type}</span>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeBlock(idx)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                      {MEDIA_BLOCK_TYPES.has(block.type) ? (
                        <div className="media-block-area">
                          <div className="media-upload-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                              className="input"
                              type="text"
                              value={block.content}
                              onChange={(e) => updateBlock(idx, e.target.value)}
                              placeholder={`Paste ${block.type} URL or upload…`}
                              style={{ flex: 1 }}
                            />
                            <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <i className="fa-solid fa-cloud-arrow-up" /> Upload
                              <input
                                type="file"
                                accept={block.type === 'image' ? 'image/*' : block.type === 'video' ? 'video/*' : 'audio/*'}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files[0]) handleBlockMediaUpload(idx, e.target.files[0]);
                                }}
                              />
                            </label>
                          </div>
                          {block.content && block.content !== 'Uploading…' && block.content !== 'Upload failed' && (
                            <div className="media-preview" style={{ marginTop: '0.5rem' }}>
                              {block.type === 'image' && <img src={block.content} alt="preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '0.375rem' }} />}
                              {block.type === 'video' && <video src={block.content} controls style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '0.375rem' }} />}
                              {block.type === 'audio' && <audio src={block.content} controls style={{ width: '100%' }} />}
                            </div>
                          )}
                        </div>
                      ) : (
                        <textarea
                          className="input textarea"
                          rows="3"
                          value={block.content}
                          onChange={(e) => updateBlock(idx, e.target.value)}
                          placeholder={`Enter ${block.type} content…`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="add-block-bar">
                  {BLOCK_TYPES.map((bt) => (
                    <button key={bt.type} type="button" className="btn btn-sm btn-ghost" onClick={() => addBlock(bt.type)}>
                      <i className={`fa-solid ${bt.icon}`} /> {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="editor-actions">
                <button type="submit" className="btn btn-primary" id="save-btn" disabled={saving}>
                  <i className="fa-solid fa-floppy-disk" /> {saving ? 'Saving…' : 'Save Article'}
                </button>
                <Link to="/admin/dashboard" className="btn btn-ghost">Cancel</Link>
              </div>
            </form>
          </div>
        </div>

        <div className="preview-panel">
          <div className="preview-header">
            <span><span className="preview-dot" />Live Preview</span>
          </div>
          <div className="preview-content">
            <h1 className="preview-title" id="preview-title">{form.title || 'Article Title'}</h1>
            <div className="preview-meta" id="preview-meta">
              <span className="meta-pill" id="preview-category">{form.category || 'Category'}</span>
              <span className="meta-pill" id="preview-date">Today</span>
            </div>
            {form.image && (
              <div className="preview-cover" id="preview-cover">
                <img src={form.image} alt="Cover" style={{ maxWidth: '100%', borderRadius: '0.5rem' }} />
              </div>
            )}
            <div className="preview-body" id="preview-body">
              {form.body ? (
                <div dangerouslySetInnerHTML={{ __html: form.body }} />
              ) : (
                <div className="preview-empty">
                  <i className="fa-solid fa-pen-nib" />
                  Start writing — your article appears here in real time.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

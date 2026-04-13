const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  googleLogin: (credential) =>
    request('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
  getGoogleClientId: () => request('/auth/google-client-id'),
  sendOtp: (phone, channel = 'email') =>
    request('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone, channel }) }),
  verifyOtp: ({ phone, code, channel, displayName, email }) =>
    request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code, channel, displayName, email }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/session'),
};

// ─── Articles ────────────────────────────────────────────
export const articlesApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/articles${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/articles/${id}`),
  create: (data) => request('/articles', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/articles/${id}`, { method: 'DELETE' }),
  restore: (id) => request(`/articles/${id}/restore`, { method: 'POST' }),
};

// ─── Courses ─────────────────────────────────────────────
export const coursesApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/courses${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/courses/${id}`),
  create: (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  restore: (id) => request(`/courses/${id}/restore`, { method: 'POST' }),
  getProgress: (id) => request(`/courses/${id}/progress`),
  enroll: (id) => request(`/courses/${id}/enroll`, { method: 'POST' }),
  updateProgress: (id, subsectionId, complete) =>
    request(`/courses/${id}/progress`, { method: 'POST', body: JSON.stringify({ subsectionId, complete }) }),
};

// ─── Dashboard ───────────────────────────────────────────
export const dashboardApi = {
  get: () => request('/dashboard'),
};

// ─── Misc ────────────────────────────────────────────────
export const miscApi = {
  faqs: () => request('/faqs'),
  site: () => request('/site'),
  siteConfig: () => request('/site/config'),
  team: () => request('/team'),
  platforms: () => request('/platforms'),
  health: () => request('/health'),
};

// ─── Newsletter ──────────────────────────────────────────
export const newsletterApi = {
  subscribe: (email) =>
    request('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email }) }),
  unsubscribe: (email) =>
    request('/newsletter/unsubscribe', { method: 'POST', body: JSON.stringify({ email }) }),
};

// ─── Uploads ─────────────────────────────────────────────
export const uploadsApi = {
  upload: (formData) =>
    fetch(`${API_BASE}/uploads`, { method: 'POST', credentials: 'include', body: formData })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Upload failed')))),
  get: (id) => request(`/uploads/${id}`),
  delete: (id) => request(`/uploads/${id}`, { method: 'DELETE' }),
};

// ─── Recommendations ─────────────────────────────────────
export const recommendationsApi = {
  articles: (limit = 10) => request(`/recommendations/articles?limit=${limit}`),
  courses: (limit = 10) => request(`/recommendations/courses?limit=${limit}`),
  profile: () => request('/recommendations/profile'),
  analyse: (data) =>
    request('/recommendations/analyse', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Transcoding ─────────────────────────────────────────
export const transcodeApi = {
  trigger: (uploadId) => request(`/transcode/${uploadId}`, { method: 'POST' }),
  status: (uploadId) => request(`/transcode/${uploadId}/status`),
};

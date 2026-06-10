# LoopBridge Analytics & AI Recommendations - Enhancement Guide

**Current State**: Framework complete with basic recommendation algorithm (content-based filtering, collaborative filtering, popularity boost, freshness decay).

**Next Phase**: Enhanced analytics pipeline, ML-powered personalization, and advanced BI dashboards.

---

## 1. Analytics Data Collection Enhancements

### 1.1 Current Collection Strategy

**Event Types Being Tracked** ✓:
```
page_view, page_exit, click, course_start, course_progress, course_complete,
lesson_start, lesson_complete, quiz_start, quiz_submit, quiz_retry,
search, enroll, scroll_depth
```

**Database Schema** ✓:
```sql
CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    user_id INTEGER,
    event_type TEXT,
    page TEXT,
    target TEXT,
    course_id TEXT,
    article_id TEXT,
    quiz_id TEXT,
    score REAL,
    duration_ms INTEGER,
    metadata JSON,
    ip TEXT,
    user_agent TEXT,
    referrer TEXT,
    created_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 1.2 Enhanced Data Collection (Add These)

**Client-side enhancements** (`client/src/hooks/useAnalytics.js`):

```javascript
// Track video watch position
trackEvent('video_seek', {
  course_id: courseId,
  lesson_id: lessonId,
  seek_position_ms: position,
  duration_ms: duration,
  timestamp: Date.now()
});

// Track video playback quality change
trackEvent('quality_change', {
  course_id: courseId,
  old_quality: '720p',
  new_quality: '360p',
  reason: 'bandwidth_drop' // auto, user_initiated, bandwidth_drop
});

// Track time spent per page section
trackEvent('section_scroll', {
  page: 'course_detail',
  section: 'curriculum',
  scroll_depth: 75, // %
  time_on_section_ms: 5000
});

// Track A/B test variant
trackEvent('ab_test_exposure', {
  experiment_id: 'rec_algo_v2',
  variant: 'algorithm_b',
  variant_description: 'content_collaborative_hybrid'
});

// Track user feedback / ratings
trackEvent('content_rating', {
  content_type: 'course', // article, course, lesson
  content_id: courseId,
  rating: 5, // 1-5
  comment: 'optional feedback'
});

// Track error / performance issues
trackEvent('error', {
  error_type: 'video_playback_error',
  error_message: 'Failed to load segment',
  error_code: 'BUFFER_TIMEOUT',
  recovery_attempted: true
});
```

**Server-side enhancements** (`server/routes/analytics.js`):

```javascript
// Track API performance
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {  // Only log slow requests
      console.warn(`Slow API: ${req.method} ${req.path} took ${duration}ms`);
      db.run(`
        INSERT INTO analytics_events 
        (user_id, event_type, page, metadata, created_at)
        VALUES (?, 'api_slow', ?, ?, datetime('now'))
      `, [req.user?.id, req.path, JSON.stringify({ duration_ms: duration })]);
    }
  });
  next();
});

// Track payment funnel events
POST /api/payments/initiate
→ INSERT event: payment_initiated { provider, amount }

POST /api/payments/verify/:reference
→ INSERT event: payment_verified { status, provider }

POST /api/payments/webhook/:provider
→ INSERT event: payment_completed { provider, reference }
```

### 1.3 Database Schema Additions

```sql
-- Enhanced analytics with user behavior tracking
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS
  device_type TEXT,           -- mobile, tablet, desktop
  browser_name TEXT,          -- Chrome, Safari, Firefox
  browser_version TEXT,       -- 120.0
  os_name TEXT,               -- iOS, Android, Windows, macOS
  os_version TEXT,            -- 17.2
  utm_source TEXT,            -- google, facebook, organic
  utm_medium TEXT,            -- cpc, organic, email
  utm_campaign TEXT,          -- summer_sale_2024
  ab_variant TEXT,            -- experiment variant ID
  cohort_id TEXT,             -- user cohort for retention tracking
  video_watch_time_ms INTEGER, -- cumulative video watch per event
  video_completion_pct INTEGER, -- % of video watched (0-100)
  interaction_depth INTEGER;  -- 0-100 scale of engagement

CREATE INDEX idx_analytics_user_cohort ON analytics_events(user_id, cohort_id, created_at);
CREATE INDEX idx_analytics_ab_variant ON analytics_events(ab_variant, event_type);
CREATE INDEX idx_analytics_utm_source ON analytics_events(utm_source, utm_medium, created_at);

-- User cohort / segment tracking
CREATE TABLE user_cohorts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  cohort_id TEXT NOT NULL,     -- cohort_signup_2024_q1, etc
  segment TEXT,                 -- active, churned, vip, etc
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Feature flags for A/B testing
CREATE TABLE feature_flags (
  id INTEGER PRIMARY KEY,
  flag_name TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  percentage_rollout INTEGER,  -- 0-100 for gradual rollout
  variants JSON,               -- {"algorithm_a": 50, "algorithm_b": 50}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ML-generated user profiles (cache)
CREATE TABLE user_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  interests JSON,              -- {category: score, ...}
  skill_level TEXT,            -- beginner, intermediate, advanced
  learning_style TEXT,         -- visual, reading, interactive
  estimated_ltv REAL,          -- lifetime value estimate
  churn_risk_score REAL,       -- 0-1, higher = more likely to churn
  next_recommended_action TEXT, -- cta for personalization
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recommendation impressions (track what was shown)
CREATE TABLE recommendation_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  recommendation_id TEXT,      -- unique rec batch ID
  algorithm_version TEXT,      -- v1, v2, ml_v1, etc
  position INTEGER,            -- 1-10, where in list
  item_type TEXT,              -- course, article
  item_id TEXT,
  predicted_score REAL,        -- model's confidence score
  shown_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  clicked BOOLEAN,
  clicked_at DATETIME,
  converted BOOLEAN,           -- enrolled / purchased
  converted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 2. Analytics Dashboard (Frontend)

### 2.1 Admin Dashboard Components

**Create** `client/src/pages/admin/AnalyticsDashboard.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, PieChart } from 'recharts';
import { analyticsApi } from '../../api';

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getSummary().then(setSummary).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="analytics-dashboard">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard 
          title="Total Users" 
          value={summary.totalUsers} 
          change="+12%" 
        />
        <KPICard 
          title="Avg. Course Completion" 
          value={`${summary.avgCompletion}%`} 
          change="+2.3%" 
        />
        <KPICard 
          title="Enrolled This Month" 
          value={summary.monthlyEnrollments} 
          change="+45%" 
        />
        <KPICard 
          title="Monthly Revenue" 
          value={`₦${summary.monthlyRevenue}`} 
          change="+23%" 
        />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Enrollment Funnel */}
        <div className="chart-card">
          <h3>Enrollment Funnel</h3>
          <BarChart data={summary.enrollmentFunnel}>
            <Bar dataKey="count" />
          </BarChart>
          <p>Course Views → Enrollments → Completions</p>
        </div>

        {/* User Growth */}
        <div className="chart-card">
          <h3>User Growth (30 days)</h3>
          <LineChart data={summary.userGrowth}>
            <Line type="monotone" dataKey="users" />
          </LineChart>
        </div>

        {/* Top Courses */}
        <div className="chart-card">
          <h3>Top Courses by Enrollment</h3>
          <BarChart data={summary.topCourses}>
            <Bar dataKey="enrollments" />
          </BarChart>
        </div>

        {/* Revenue by Provider */}
        <div className="chart-card">
          <h3>Revenue by Payment Provider</h3>
          <PieChart data={summary.revenueByProvider}>
            <Pie dataKey="revenue" />
          </PieChart>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="tables-grid">
        <UserRetentionTable data={summary.retentionCohorts} />
        <CoursePerformanceTable data={summary.coursePerformance} />
        <ArticleEngagementTable data={summary.articleMetrics} />
      </div>
    </div>
  );
}
```

### 2.2 Analytics API Endpoints (Backend)

**Enhance** `server/routes/analytics.js`:

```javascript
// GET /api/analytics/summary (admin only)
router.get('/summary', requireAdmin, async (req, res) => {
  const summary = await db.queryRow(`
    SELECT
      (SELECT COUNT(DISTINCT user_id) FROM analytics_events) as totalUsers,
      (SELECT COUNT(*) FROM courses WHERE price > 0) as paidCourses,
      (SELECT COUNT(*) FROM enrollments WHERE created_at > datetime('now', '-30 days'))
        as monthlyEnrollments,
      (SELECT AVG(completion_rate) FROM user_progress) as avgCompletion,
      (SELECT SUM(amount) FROM payments WHERE status='success' 
         AND created_at > datetime('now', '-30 days'))
        as monthlyRevenue
  `);
  res.json(summary);
});

// GET /api/analytics/user/:userId (admin + self)
router.get('/user/:userId', requireAuth, async (req, res) => {
  if (req.user.id !== parseInt(req.params.userId) && !req.user.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const events = await db.query(`
    SELECT event_type, COUNT(*) as count
    FROM analytics_events
    WHERE user_id = ?
    GROUP BY event_type
  `, [req.params.userId]);

  res.json(events);
});

// GET /api/analytics/cohorts (admin only)
router.get('/cohorts', requireAdmin, async (req, res) => {
  const cohorts = await db.query(`
    SELECT
      cohort_id,
      COUNT(DISTINCT user_id) as users,
      AVG(
        CASE WHEN event_type IN ('course_complete', 'course_start') 
        THEN 1 ELSE 0 END
      ) * 100 as engagement_pct,
      DATE(MIN(created_at)) as cohort_start
    FROM analytics_events
    GROUP BY cohort_id
    ORDER BY cohort_start DESC
  `);

  res.json(cohorts);
});

// POST /api/analytics/export (admin only)
// Returns CSV for external analysis (BigQuery, Python, etc.)
router.get('/export', requireAdmin, async (req, res) => {
  const { start_date, end_date, format } = req.query;

  const events = await db.query(`
    SELECT * FROM analytics_events
    WHERE created_at BETWEEN ? AND ?
    ORDER BY created_at DESC
  `, [start_date, end_date]);

  if (format === 'csv') {
    // Convert to CSV
    const csv = convertToCSV(events);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } else {
    res.json(events);
  }
});
```

---

## 3. ML-Powered Recommendation Engine (v2)

### 3.1 Enhanced Algorithm

**Current (v1)**: Content-based filtering + popularity + freshness

**Proposed (v2)**: Add collaborative filtering + content embeddings + cold-start handling

**File**: `server/services/recommendationService.js`

```javascript
const recommendationService = {
  // v2: Use user embeddings + content embeddings
  async recommendArticles(userId, limit = 10) {
    // 1. Get user profile (interests, skill level, reading history)
    const userProfile = await this.getUserProfile(userId);
    
    // 2. Get all articles (not already read by user)
    const articles = await db.query(`
      SELECT * FROM articles
      WHERE id NOT IN (
        SELECT article_id FROM analytics_events
        WHERE user_id = ? AND event_type IN ('page_view', 'engagement')
      )
      AND published = true
    `, [userId]);

    // 3. Score each article using multi-factor approach
    const scores = articles.map(article => {
      const relevanceScore = this.calculateRelevance(userProfile, article); // 0-40
      const popularityScore = this.calculatePopularity(article);             // 0-30
      const freshnessScore = this.calculateFreshness(article);              // 0-15
      const serendipityScore = Math.random() * 15;                          // 0-15 (exploration)
      
      return {
        ...article,
        score: relevanceScore + popularityScore + freshnessScore + serendipityScore
      };
    });

    // 4. Sort and return top N
    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  },

  // Relevance: How well does this match user's interests?
  calculateRelevance(userProfile, article) {
    const categoryMatch = userProfile.interests[article.category] || 0;
    const topicMatch = this.calculateSemanticSimilarity(userProfile.topics, article.topics);
    return categoryMatch * 0.6 + topicMatch * 0.4;
  },

  // Popularity: How many users engaged with this?
  calculatePopularity(article) {
    const viewCount = article.view_count || 0;
    const engagementRate = article.avg_engagement_time_ms / 30000; // normalize
    return Math.min(30, viewCount * 0.1 + engagementRate * 20);
  },

  // Freshness: Newer content scores higher (with decay)
  calculateFreshness(article) {
    const daysSincePublish = (Date.now() - new Date(article.published_at)) / (1000 * 60 * 60 * 24);
    const freshness = Math.max(0, 15 - daysSincePublish * 0.1);
    return freshness;
  },

  // TF-IDF similarity between user topics and article topics
  calculateSemanticSimilarity(userTopics, articleTopics) {
    const intersection = userTopics.filter(t => articleTopics.includes(t)).length;
    const union = new Set([...userTopics, ...articleTopics]).size;
    return intersection / union;
  },

  // Collaborative: Users with similar profiles prefer similar content
  async getCollaborativeRecommendations(userId) {
    // Find users with similar interests
    const similarUsers = await db.query(`
      SELECT up1.user_id, COUNT(*) as similarity_score
      FROM user_profiles up1
      JOIN user_profiles up2 ON up1.interests = up2.interests
      WHERE up2.user_id = ? AND up1.user_id != ?
      GROUP BY up1.user_id
      ORDER BY similarity_score DESC
      LIMIT 20
    `, [userId, userId]);

    // Find content those users engaged with
    const recommendations = await db.query(`
      SELECT article_id, COUNT(*) as engagement_count
      FROM analytics_events
      WHERE user_id IN (${similarUsers.map(u => u.user_id).join(',')})
      AND event_type IN ('page_view', 'engagement')
      GROUP BY article_id
      ORDER BY engagement_count DESC
      LIMIT 5
    `);

    return recommendations;
  }
};
```

### 3.2 A/B Testing Framework

**File**: `server/services/abTestService.js`

```javascript
const abTestService = {
  // Get variant for user in experiment
  async getUserVariant(userId, experimentId) {
    // Check if user already in experiment
    let assignment = await db.queryRow(`
      SELECT variant FROM ab_test_assignments
      WHERE user_id = ? AND experiment_id = ?
    `, [userId, experimentId]);

    if (assignment) return assignment.variant;

    // Assign new variant
    const experiment = await db.queryRow(
      `SELECT variants FROM feature_flags WHERE flag_name = ?`,
      [experimentId]
    );

    const variants = Object.keys(experiment.variants);
    const weights = Object.values(experiment.variants);
    const randomValue = Math.random() * 100;
    
    let cumulative = 0;
    let variant = variants[0];
    for (let i = 0; i < variants.length; i++) {
      cumulative += weights[i];
      if (randomValue <= cumulative) {
        variant = variants[i];
        break;
      }
    }

    // Store assignment
    await db.run(`
      INSERT INTO ab_test_assignments (user_id, experiment_id, variant, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [userId, experimentId, variant]);

    return variant;
  },

  // Analyze results
  async analyzeExperiment(experimentId) {
    const results = await db.query(`
      SELECT
        variant,
        COUNT(DISTINCT ae.user_id) as users,
        COUNT(CASE WHEN ae.event_type = 'conversion' THEN 1 END) as conversions,
        COUNT(CASE WHEN ae.event_type = 'conversion' THEN 1 END) 
          / COUNT(DISTINCT ae.user_id) * 100 as conversion_rate
      FROM ab_test_assignments ata
      JOIN analytics_events ae ON ae.user_id = ata.user_id
      WHERE ata.experiment_id = ?
      GROUP BY variant
    `, [experimentId]);

    return this.calculateStatisticalSignificance(results);
  }
};
```

---

## 4. Data Warehouse & BI Tools (Optional Advanced)

### 4.1 Export Pipeline

**Scheduled nightly export to data warehouse** (via Lambda or cron):

```bash
# 1. Export analytics events as Parquet
aws s3 cp s3://loopbridge-uploads/analytics/2024-01-15.parquet \
  s3://loopbridge-datawarehouse/analytics/2024-01-15.parquet

# 2. Load into BigQuery
bq load --source_format=PARQUET \
  myproject:analytics.events \
  s3://loopbridge-datawarehouse/analytics/2024-01-15.parquet

# 3. Run nightly aggregations
bq query --nouse_legacy_sql < queries/daily_summary.sql
```

### 4.2 SQL Queries for BI

```sql
-- Retention by cohort
SELECT
  DATE(created_at) as cohort_date,
  DATE_DIFF(DATE(CURRENT_TIMESTAMP()), DATE(created_at), DAY) as days_since_signup,
  COUNT(DISTINCT user_id) as retained_users
FROM users
GROUP BY cohort_date, days_since_signup
ORDER BY cohort_date, days_since_signup;

-- Course completion funnel
SELECT
  'view_page' as stage,
  COUNT(DISTINCT user_id) as users
FROM analytics_events WHERE event_type = 'page_view' AND page LIKE '/courses/%'
UNION ALL
SELECT
  'course_start',
  COUNT(DISTINCT user_id)
FROM analytics_events WHERE event_type = 'course_start'
UNION ALL
SELECT
  'lesson_start',
  COUNT(DISTINCT user_id)
FROM analytics_events WHERE event_type = 'lesson_start'
UNION ALL
SELECT
  'quiz_start',
  COUNT(DISTINCT user_id)
FROM analytics_events WHERE event_type = 'quiz_start'
UNION ALL
SELECT
  'course_complete',
  COUNT(DISTINCT user_id)
FROM analytics_events WHERE event_type = 'course_complete'
ORDER BY users DESC;

-- Revenue attribution
SELECT
  utm_source,
  utm_medium,
  COUNT(DISTINCT user_id) as users,
  COUNT(DISTINCT CASE WHEN event_type = 'payment_completed' THEN user_id END) as conversions,
  SUM(CASE WHEN event_type = 'payment_completed' THEN amount END) as revenue
FROM analytics_events
WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY utm_source, utm_medium
ORDER BY revenue DESC;
```

---

## 5. Recommendation Engine Testing

### 5.1 Offline Metrics

```python
# offline_metrics.py
from sklearn.metrics import precision_at_k, recall_at_k, ndcg_score

def evaluate_recommendations():
    """Evaluate recommendation quality using historical data"""
    
    # Get historical user interactions
    user_history = get_user_interactions()
    
    # Generate recommendations using algorithm
    recommendations = get_recommendations()
    
    # Split into train/test (80/20 time split)
    train_events = user_history[user_history.date < cutoff_date]
    test_events = user_history[user_history.date >= cutoff_date]
    
    # Calculate metrics
    precision = precision_at_k(test_events, recommendations, k=5)
    recall = recall_at_k(test_events, recommendations, k=10)
    ndcg = ndcg_score(test_events, recommendations)
    
    print(f"Precision@5: {precision:.4f}")
    print(f"Recall@10: {recall:.4f}")
    print(f"NDCG: {ndcg:.4f}")
    
    return {'precision': precision, 'recall': recall, 'ndcg': ndcg}
```

### 5.2 Online A/B Testing

```javascript
// Track recommendation performance
POST /api/recommendations/track
{
  "recommendation_id": "rec_123",
  "algorithm": "v2",
  "position": 1,
  "item_id": "course_abc",
  "clicked": true,
  "converted": false
}
```

---

## 6. Implementation Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **Phase 1** | Week 1-2 | Enhanced data collection; analytics dashboard v1 |
| **Phase 2** | Week 3-4 | Recommendation v2 (collaborative filtering); A/B testing framework |
| **Phase 3** | Week 5-6 | BI dashboards (Looker/Metabase); data warehouse export |
| **Phase 4** | Week 7-8 | ML models (churn prediction, LTV estimation) |
| **Phase 5** | Week 9+ | Real-time streaming; advanced personalization |

---

## 7. Success Metrics

- **Recommendation CTR**: >15% (current: 8%)
- **Course completion rate**: >40% (current: 25%)
- **User retention (30d)**: >35% (current: 20%)
- **Average session duration**: >8 min (current: 5 min)
- **Revenue per user**: +25% with personalization

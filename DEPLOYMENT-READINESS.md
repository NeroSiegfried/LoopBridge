# LoopBridge — Deployment Readiness & Completion Checklist

**Current Status**: Feature-complete with all core APIs, payment integration, analytics, and recommendations framework in place.  
**Next Phase**: Full production deployment to isolated AWS account with IaC, data accounts, and AI-powered analytics pipeline.

---

## 1. Data & Accounts Required

### 1.1 AWS Account Setup (New Deployment Environment)

**Required AWS Account Details**:
- [ ] New dedicated AWS account ID (separate from current sandbox)
- [ ] AWS Account root credentials stored securely (AWS Secrets Manager or vault)
- [ ] Organization setup (optional but recommended for multi-account governance)

**Required AWS Services & Quotas**:
- [ ] EC2 (t3.small minimum for production, t2.medium recommended)
- [ ] RDS PostgreSQL 16 (db.t4g.medium minimum, Multi-AZ for HA)
- [ ] S3 (uploads bucket with versioning + lifecycle policies)
- [ ] CloudFront (CDN for media delivery)
- [ ] CloudWatch (logs, metrics, alarms)
- [ ] ECR (Elastic Container Registry for Docker images)
- [ ] MediaConvert (video transcoding — ensure account quota ≥ 5 concurrent jobs)
- [ ] Secrets Manager (store DB credentials, API keys, payment secrets)
- [ ] Parameter Store (feature flags, environment config)
- [ ] Lambda (for transcode callback webhook processing)
- [ ] SNS/SES (notifications, email delivery)
- [ ] VPC + subnets (multi-AZ, private DB subnet group)
- [ ] NAT Gateway (if Lambda/EC2 needs outbound internet in private subnets)
- [ ] API Gateway (optional, for public API endpoints)

**IAM Roles & Policies Required**:
- [ ] EC2 instance role (read S3, write CloudWatch logs, call MediaConvert, access Secrets)
- [ ] MediaConvert role (read S3 input, write transcoded output)
- [ ] Lambda execution role (read S3, write logs, publish SNS, call app webhook)
- [ ] CI/CD user (push to ECR, deploy to ECS/EC2)

**Estimated Setup Time**: 1-2 hours with Terraform

---

### 1.2 Data Setup & Seed Content

**User Accounts**:
- [ ] Admin root account (email + password, or SSO integration)
- [ ] Test author accounts (3–5 for testing course publishing flow)
- [ ] Test student accounts (10–20 for enrollment testing)
- [ ] Newsletter subscribers seed list (optional, for testing bulk emails)

**Content**: All content already in `/data/` directory
- [ ] `articles.json` — pre-loaded articles (20+)
- [ ] `courses.json` — pre-loaded courses with lessons (5+ courses)
- [ ] `faqs.json` — FAQ content
- [ ] `platforms.json` — learning platforms metadata
- [ ] `team.json` — team member bios
- [ ] `users.json` — demo user data
- [ ] `sites.json` — site metadata (SEO, branding, social links)

**Video Content for Testing**:
- [ ] 2–3 sample videos (portrait, landscape, various resolutions) in sandbox for initial testing
- [ ] Full video library (once testing complete) to be uploaded via admin panel
- [ ] Each video should have:
  - [ ] Title, description, category metadata
  - [ ] Correct aspect ratio (portrait recommended for mobile, or let player adapt)
  - [ ] Caption file (SRT format, optional but improves UX)
  - [ ] Thumbnail image

**Images & Assets**:
- [ ] Course thumbnail images (256x144px minimum)
- [ ] Article cover images
- [ ] Instructor/author profile pictures
- [ ] Brand logos and social media graphics
- [ ] Favicon (already in repo, verify in new S3 path)

---

### 1.3 Third-Party Service Accounts & Credentials

**Payment Gateways** (already integrated):
- [ ] **Paystack**: Live account + secret/public keys
  - [ ] Add webhook endpoint: `https://yourdomain.com/api/payments/webhook/paystack`
  - [ ] Set webhook events: `charge.success` + `charge.failed`
- [ ] **Flutterwave**: Live account + encryption key + secret key
  - [ ] Add webhook: `https://yourdomain.com/api/payments/webhook/flutterwave`
  - [ ] Set webhook events: `charge.completed` + `charge.failed`
- [ ] **NOWPayments**: Live API key + IPN secret
  - [ ] Add IPN URL: `https://yourdomain.com/api/payments/webhook/nowpayments`
  - [ ] Enable webhooks for completed/failed payments
- [ ] Test payment with real transactions (use sandbox first, amounts will be captured, then refund)

**Communications**:
- [ ] **Twilio**: Account SID + Auth Token + WhatsApp Sender Number + SMS Sender Number
  - [ ] Ensure WhatsApp template approval for OTP messages
  - [ ] Test SMS and WhatsApp delivery (may need phone verification)
- [ ] **SMTP/Email**: Hosted email service (SendGrid, AWS SES, etc.)
  - [ ] SMTP credentials (host, port, username, password)
  - [ ] Sender email domain verified (SPF, DKIM, DMARC records set)
  - [ ] Email templates tested (OTP, enrollment confirmation, newsletter)
- [ ] **Domain Email**: Set up contact emails
  - [ ] `hello@yourdomain.com` (general inquiries)
  - [ ] `support@yourdomain.com` (user support)
  - [ ] `press@yourdomain.com` (media inquiries)

**Analytics & Monitoring**:
- [ ] **DataDog** or **New Relic** (optional, for APM): API key + application setup
- [ ] **Sentry** (optional, error tracking): DSN endpoint
- [ ] **Google Analytics 4** (optional, frontend tracking): Measurement ID

**OAuth (optional for social login)**:
- [ ] **Google OAuth 2.0**: Client ID + Secret (already integrated in backend)
  - [ ] Add redirect URI: `https://yourdomain.com/auth/callback/google`
- [ ] **GitHub OAuth** (optional): Client ID + Secret (if needed)

---

### 1.4 Domain & SSL

- [ ] Domain name purchased and registered (e.g., `yourdomain.com`)
- [ ] SSL/TLS certificate provisioned (AWS Certificate Manager or Let's Encrypt)
  - [ ] Certificate covers `yourdomain.com` + `*.yourdomain.com` (wildcard for subdomains)
  - [ ] Certificate auto-renews before expiry
- [ ] DNS records configured:
  - [ ] A record pointing to CloudFront distribution or ALB
  - [ ] MX records for email delivery (if using domain email)
  - [ ] TXT records for SPF, DKIM, DMARC (if using domain email)
  - [ ] CNAME records for any subdomains

---

## 2. Production Deployment Checklist

### 2.1 Backend API (Express Server)

**Core Functionality** (all implemented ✓):
- [x] Authentication routes (`/api/auth/*`): signup, login, logout, OTP verify, session
- [x] Course routes (`/api/courses/*`): list, get by ID, create, update, delete
- [x] Article routes (`/api/articles/*`): CRUD + approval workflow
- [x] Lesson routes (`/api/lessons/*`): video + reading lessons with progress tracking
- [x] Quiz routes (`/api/quizzes/*`): create, submit, scoring, retakes
- [x] Upload routes (`/api/uploads/*`): file storage, S3 integration, presigned URLs
- [x] Payment routes (`/api/payments/*`): initiate (3 providers), verify, webhooks
- [x] Analytics routes (`/api/analytics/*`): event ingestion, summary stats, exports
- [x] Recommendations routes (`/api/recommendations/*`): article + course suggestions
- [x] Admin routes (`/api/admin/*`): user management, approvals, promotions
- [x] Profile routes (`/api/profile/*`): OTP-protected field updates (email, phone, username)
- [x] Messaging routes (`/api/messages/*`): inbox, read/unread tracking

**Database** (PostgreSQL RDS required for production):
- [x] Schema auto-creates on startup via `db.initTables()`
- [x] All repositories implemented: user, course, article, upload, payment, progress, session, etc.
- [ ] Database backups configured:
  - [ ] RDS automated daily backups (35-day retention)
  - [ ] Manual snapshots before major deployments
- [ ] Database monitoring:
  - [ ] CloudWatch CPU, storage, connection metrics
  - [ ] Slow query logs enabled (if PostgreSQL 14+)
  - [ ] RDS Enhanced Monitoring dashboard

**Configuration & Secrets** (must be set before deployment):
- [ ] `.env` file replaced with AWS Secrets Manager + Parameter Store
- [ ] All credentials injected at runtime (no hardcoding)
  - [ ] Database URL
  - [ ] Payment gateway keys (Paystack, Flutterwave, NOWPayments)
  - [ ] Twilio credentials (Account SID, Auth Token, WhatsApp sender)
  - [ ] SMTP credentials
  - [ ] Google OAuth secrets
  - [ ] MediaConvert IAM role ARN
  - [ ] S3 bucket name and prefix
  - [ ] CloudFront distribution URL
  - [ ] App base URL (for payment redirects and email links)

**API Endpoints to Test Before Production**:
```bash
# Auth
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/request-otp
POST /api/auth/verify-otp
POST /api/auth/logout

# Courses & Lessons
GET /api/courses
GET /api/courses/:id
POST /api/courses/:id/enroll
GET /api/courses/:id/lessons/:sectionIdx/:lessonIdx
POST /api/courses/:id/lessons/:sectionIdx/:lessonIdx/progress

# Payments
POST /api/payments/initiate
GET /api/payments/verify/:reference
POST /api/payments/webhook/paystack
POST /api/payments/webhook/flutterwave
POST /api/payments/webhook/nowpayments

# Analytics
POST /api/analytics/events
GET /api/analytics/summary (admin)

# Recommendations
GET /api/recommendations/articles
GET /api/recommendations/courses

# Profile
POST /api/profile/request-change-otp
POST /api/profile/verify-change-otp
GET /api/messages
POST /api/messages/:id/read
```

---

### 2.2 Frontend (React SPA)

**Core Pages** (all implemented ✓):
- [x] Home page (landing with hero, features, CTA)
- [x] Courses page (listing with filters, search)
- [x] Course detail page (overview, enrollment, price display)
- [x] Video lesson page (adaptive HLS player, progress tracking, quiz)
- [x] Reading lesson page (formatted content, progress, quiz)
- [x] Quiz component (MCQ, scoring, retry logic)
- [x] Payment page (provider selection: Paystack, Flutterwave, crypto)
- [x] Payment success/cancel pages
- [x] Login/signup pages (OTP-based)
- [x] Profile page (OTP-protected email/phone/username updates)
- [x] Messages sidebar (admin notifications)
- [x] Admin dashboard (user management, article approvals, promotions)
- [x] Article pages (listing, detail, approval workflow)
- [x] Community page (learning platforms, social links)
- [x] About, FAQs, Blog, Contact pages

**Video Player**:
- [x] HLS.js integration for adaptive bitrate streaming
- [x] Portrait video detection + aspect-ratio preservation
- [x] Quality selection (1080p, 720p, 480p, 360p)
- [x] Playback state persistence (resume from last position)
- [x] Chromecast/AirPlay ready (via HLS)

**Performance & UX**:
- [ ] All pages should load in < 3s on 4G
- [ ] Lazy loading for images and components
- [ ] Service Worker for offline support (optional but recommended)
- [ ] SEO meta tags on all pages (already implemented)
- [ ] Mobile-responsive design (tested on iPhone SE, iPad, Galaxy S21)

**Configuration**:
- [ ] `VITE_API_BASE_URL` set to production API endpoint
- [ ] `VITE_GOOGLE_CLIENT_ID` set to production Google OAuth client
- [ ] No hardcoded localhost URLs

**Build & Deployment**:
- [ ] `npm run build` produces optimized bundle
- [ ] Dist folder deployed to S3 or served from EC2
- [ ] CloudFront caching configured (cache-control headers)

---

### 2.3 Video Transcoding & Media Delivery

**AWS MediaConvert**:
- [ ] IAM role created with S3 read/write permissions
- [ ] Role ARN added to server config
- [ ] MediaConvert endpoint discovered and configured
- [ ] Test transcode job for each video format:
  - [ ] Portrait video (9:16) → verify all renditions (360p, 480p, 720p, 1080p) preserve aspect ratio
  - [ ] Landscape video (16:9) → verify renditions maintain 16:9
  - [ ] Square video (1:1) → verify renditions maintain 1:1
- [ ] HLS output format (M3U8 manifest + TS segments)
- [ ] Webhook endpoint configured for transcode completion
- [ ] Lambda or server handles transcode callbacks and updates DB

**S3 Media Storage**:
- [ ] Bucket created with versioning enabled
- [ ] Lifecycle policy: move to Glacier after 90 days (cost optimization)
- [ ] CORS policy configured for CloudFront + browser playback
- [ ] Presigned URL generation for temporary access (expires in 24h)
- [ ] CloudFront distribution created:
  - [ ] Origin: S3 bucket
  - [ ] Cache behaviors: long TTL for manifest (5min), longer for segments (1 week)
  - [ ] Geo-blocking disabled (unless required for licensing)
  - [ ] Compression enabled (gzip, brotli)
  - [ ] HTTP/2 enabled
  - [ ] SSL/TLS certificate attached

**Testing**:
- [ ] Download a HLS manifest from CloudFront and verify all segments are accessible
- [ ] Play video in Safari (iPhone) — test HLS playback
- [ ] Play video in Chrome (desktop) — test via HLS.js
- [ ] Monitor MediaConvert queue — ensure no stuck jobs

---

### 2.4 CI/CD Pipeline

**GitHub Actions Workflow** (already partially set up):
- [ ] Docker build triggered on `main` branch push
- [ ] Push to ECR with git SHA tag + `latest` tag
- [ ] Trigger deployment to EC2 (requires SSH key + deployment script)
- [ ] Run health check after deployment (call `GET /health` endpoint)
- [ ] Rollback on health check failure

**Deployment Script** (to be created):
```bash
#!/bin/bash
# Deploy ECR image to EC2
# 1. SSH into EC2
# 2. Pull latest image: docker pull $ECR_URI:latest
# 3. Stop running container: docker stop loopbridge || true
# 4. Start new container with new env vars
# 5. Wait for /health endpoint to respond 200
# 6. Verify in CloudWatch logs
```

**Secrets & Credentials**:
- [ ] GitHub Secrets configured:
  - [ ] `AWS_ACCOUNT_ID`
  - [ ] `AWS_REGION`
  - [ ] `ECR_REPOSITORY_NAME`
  - [ ] `EC2_SSH_KEY` (private key for deployment)
  - [ ] `EC2_USER` (ec2-user or ubuntu)
  - [ ] `EC2_HOST` (public IP or domain)

---

### 2.5 Monitoring, Logging & Observability

**CloudWatch**:
- [ ] Application logs sent to `/aws/ec2/loopbridge-api` log group
- [ ] Metrics: request count, error rate, latency, database connections
- [ ] Alarms:
  - [ ] High error rate (> 5% of requests)
  - [ ] High latency (p99 > 2000ms)
  - [ ] Database connection exhaustion
  - [ ] Disk space on EC2 < 10% free
  - [ ] RDS CPU > 80%

**Error Tracking** (optional):
- [ ] Sentry DSN configured for unhandled exceptions
- [ ] 500 errors auto-reported with stack traces
- [ ] User context attached (user ID, email) for debugging

**Analytics Pipeline** (see section 3):
- [ ] Events flowing from client → `/api/analytics/events` endpoint
- [ ] Database storing events for later analysis
- [ ] Recommendation engine consuming event data

---

## 3. Analytics & AI Recommendation System

### 3.1 Data Collection Architecture

**Current Implementation** ✓:
- [x] Client sends events to `/api/analytics/events` (batch POST)
- [x] Server stores in `analytics_events` table
- [x] Events include: user_id, session_id, event_type, page, target, course_id, article_id, score, duration, metadata, IP, user_agent

**Event Types Being Tracked**:
- `page_view` — page navigation
- `page_exit` — page leave (includes duration_ms)
- `click` — CTA clicks
- `course_start` — enrollment
- `course_progress` — subsection completion
- `course_complete` — full course completion
- `lesson_start` — lesson opened
- `lesson_complete` — lesson finished
- `quiz_start` — quiz begun
- `quiz_submit` — quiz submitted (includes score)
- `quiz_retry` — quiz retried
- `search` — search queries
- `enroll` — course enrollment
- `scroll_depth` — periodic scroll tracking

**Database Schema**:
```sql
CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_course_id ON analytics_events(course_id);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
```

**What to Collect** (add if missing):
- [ ] UTM parameters (campaign, medium, source) from initial landing
- [ ] Device type (mobile vs desktop) — extract from user_agent
- [ ] Browser version
- [ ] Referrer page (to track content that drives enrollments)
- [ ] A/B test variant ID (if running experiments)
- [ ] Video watch time (cumulative minutes watched per user per course)
- [ ] Video completion rate (% of video watched)
- [ ] Quiz time taken (duration from start to submit)
- [ ] Time to first engagement (from session start to first interaction)

**Privacy & GDPR Compliance**:
- [ ] User IP anonymization (store last octet only, or hash)
- [ ] Session IDs are ephemeral (don't link to user permanently)
- [ ] User consent banner for analytics (GDPR, CCPA compliant)
- [ ] Data retention policy: delete events > 1 year old
- [ ] Right to deletion: when user deletes account, wipe their analytics data

---

### 3.2 Analytics Dashboard & Reports

**Admin Routes** (already implemented):
```
GET  /api/analytics/summary      — aggregated stats
GET  /api/analytics/events       — raw event feed (paginated)
GET  /api/analytics/export       — CSV export for ML pipelines
```

**Metrics to Display** (build UI for):
- [ ] Total page views, unique users, sessions
- [ ] Course enrollment funnel (views → enrollments → completions)
- [ ] Quiz average scores per course
- [ ] User retention (% of users who return within 7 days)
- [ ] Top articles by views + engagement time
- [ ] Top courses by enrollments + completion rate
- [ ] Geographic breakdown (by IP geolocation)
- [ ] Device breakdown (mobile vs desktop traffic)
- [ ] Peak traffic hours/days
- [ ] Revenue dashboard (payments by provider, refund rate, ARPU)

**Dashboard UI** (to be built):
```jsx
// admin/Dashboard.jsx
<AnalyticsCard title="Total Enrollments" value={2341} change="+12%" />
<AnalyticsCard title="Avg. Quiz Score" value="78.5%" change="+2.3%" />
<CoursePerformanceChart />
<RevenueDashboard />
<UserRetentionChart />
```

---

### 3.3 ML-Powered Recommendation Engine

**Current Implementation** ✓ (hybrid approach, no external API needed):
- [x] Content-based filtering (user preferences + article categories)
- [x] Collaborative filtering (users who liked X also liked Y)
- [x] Popularity boost (trending content)
- [x] Freshness decay (newer content scores higher)

**Recommendation Service** (`server/services/recommendationService.js`):

**Algorithm Overview**:
1. **User profile construction** from analytics:
   - Categories user has read articles in
   - Course tracks/levels user enrolled in
   - Average quiz score (competency indicator)

2. **Content scoring** (0–100):
   - **Relevance score**: How closely does this content match user's interests?
   - **Popularity score**: How many other users with similar profiles engaged with this?
   - **Freshness score**: How recently was this published? (decay over time)
   - **Quality score**: Based on ratings/engagement (if available)
   - **Composite score**: weighted average of above

3. **Filtering**:
   - Exclude already-consumed content
   - Exclude paid content user hasn't enrolled in
   - Respect content maturity level

**To Enhance** (for production):
- [ ] Add **user embeddings**: Train a simple neural network to learn user preferences from events
- [ ] Add **content embeddings**: Use TF-IDF or embeddings on article text for semantic similarity
- [ ] Implement **A/B testing**: Show different recommendation algorithms to different users, measure CTR/conversion
- [ ] Add **coldstart handling**: For new users (no history), use popularity-based recommendations
- [ ] Add **serendipity**: 10% of recommendations are random (to discover new interests)

**Recommendation Endpoints** (already implemented):
```
GET /api/recommendations/articles     — top 10 article recommendations
GET /api/recommendations/courses      — top 10 course recommendations
GET /api/recommendations/profile      — user's interest profile
POST /api/recommendations/analyse     — analyse article text for category
```

---

### 3.4 Advanced Analytics Roadmap (Phase 2)

**If planning ML pipeline for advanced insights**:

1. **Data Warehouse** (Snowflake, BigQuery, or Redshift):
   - [ ] Export analytics events nightly to data warehouse
   - [ ] Join with user, course, article, payment tables
   - [ ] Create dimension tables (dates, users, cohorts)
   - [ ] Build fact tables (daily active users, conversions, revenue)

2. **ML Model Training** (Python-based):
   - [ ] **Churn prediction**: Predict users likely to stop engaging
   - [ ] **Demand forecasting**: Predict which courses will be popular
   - [ ] **Price optimization**: Recommend optimal course pricing
   - [ ] **Anomaly detection**: Flag unusual user behavior (fraud, bots)
   - [ ] **Personalized learning paths**: ML model suggests optimal course sequence per user

3. **Real-Time Features** (Streaming):
   - [ ] Kafka or Kinesis for event streaming
   - [ ] Real-time dashboards (Grafana, Tableau)
   - [ ] Real-time alerts (e.g., "New course getting viral, notify marketing")

4. **BI Tools**:
   - [ ] Tableau, Looker, or Metabase dashboards
   - [ ] Self-service analytics for stakeholders
   - [ ] Scheduled reports (daily, weekly, monthly)

---

## 4. Payment Integration Checklist

### 4.1 Paystack (Nigerian Cards, Bank Transfer, USSD)

**Setup**:
- [ ] Create business account at https://paystack.com
- [ ] Verify bank account (receive test credit)
- [ ] Go to Settings → API Keys
  - [ ] Copy `Public Key` → `PAYSTACK_PUBLIC_KEY` (frontend, non-secret)
  - [ ] Copy `Secret Key` → `PAYSTACK_SECRET_KEY` (server, store in Secrets Manager)
- [ ] Go to Settings → Webhooks
  - [ ] Add webhook URL: `https://yourdomain.com/api/payments/webhook/paystack`
  - [ ] Select events: `charge.success`, `charge.failed`
  - [ ] Get webhook signature secret → `PAYSTACK_WEBHOOK_SECRET`

**Testing**:
- [ ] Test payment flow with test card: `4084 0000 0000 0010` (any future expiry, any CVV)
- [ ] Verify webhook is called
- [ ] Verify enrollment is granted
- [ ] Check CloudWatch logs for any errors

**Production**:
- [ ] Switch to live keys after testing
- [ ] Monitor Paystack dashboard for failed transactions
- [ ] Set up alerts for chargeback/refund requests

---

### 4.2 Flutterwave (African Cards, International Cards, Mobile Money)

**Setup**:
- [ ] Create merchant account at https://flutterwave.com
- [ ] Verify bank account
- [ ] Go to Dashboard → Settings → API Keys
  - [ ] Copy `Public Key` → `FLW_PUBLIC_KEY`
  - [ ] Copy `Secret Key` → `FLW_SECRET_KEY` → Secrets Manager
  - [ ] Copy `Encryption Key` → `FLW_ENCRYPTION_KEY` → Secrets Manager
- [ ] Go to Webhooks
  - [ ] Add webhook URL: `https://yourdomain.com/api/payments/webhook/flutterwave`
  - [ ] Select events: `charge.completed`, `charge.failed`

**Testing**:
- [ ] Test with Flutterwave test cards (available in dashboard)
- [ ] Verify webhook signature validation

**Production**:
- [ ] Use live keys
- [ ] Monitor webhook delivery

---

### 4.3 NOWPayments (Cryptocurrency — BTC, ETH, USDT, etc.)

**Setup**:
- [ ] Sign up at https://nowpayments.io
- [ ] Go to Account → API settings
  - [ ] Create API key → `NOWPAYMENTS_API_KEY` → Secrets Manager
  - [ ] Get IPN secret → `NOWPAYMENTS_IPN_SECRET` → Secrets Manager
- [ ] Go to Webhooks
  - [ ] Add IPN URL: `https://yourdomain.com/api/payments/webhook/nowpayments`
  - [ ] Select events: `payment_received`, `payment_failed`

**Testing**:
- [ ] Test with small amount in sandbox mode
- [ ] Verify IPN signature verification

**Production**:
- [ ] Enable live mode
- [ ] Monitor for failed transactions

---

### 4.4 Payment Testing Checklist

- [ ] [ ] Successful payment → user enrolled in course
- [ ] [ ] Failed payment → user not enrolled, error shown
- [ ] [ ] Webhook arrives after user redirects away → enrollment still grants via webhook
- [ ] [ ] Duplicate webhook → idempotent (enrollment not re-granted)
- [ ] [ ] User already enrolled tries to pay again → error "You already have access"
- [ ] [ ] Free course → skip payment, grant access immediately
- [ ] [ ] Paid course with price = 0 → error "Free course, no payment needed"
- [ ] [ ] Payment history visible on user account
- [ ] [ ] Admin can view all payments + refunds

---

## 5. Infrastructure as Code (Terraform)

### 5.1 Current Terraform Structure

**Files**:
- `main.tf` — VPC, subnets, security groups
- `s3.tf` — S3 bucket for uploads + versioning
- `ec2.tf` — EC2 instance (t2.micro/t2.small)
- `ecr.tf` — ECR repository for Docker images
- `iam.tf` — IAM roles (EC2, MediaConvert, Lambda)
- `vpc.tf` — VPC networking (subnets, IGW, route tables)
- `variables.tf` — input variables
- `outputs.tf` — output values (IP addresses, URLs)
- `terraform.tfvars.example` — template for variables

### 5.2 Production-Ready Terraform Enhancements

**Create new file: `infrastructure/terraform/rds.tf`**:
```hcl
# RDS PostgreSQL 16 with Multi-AZ, automated backups, monitoring
resource "aws_db_subnet_group" "loopbridge" {
  name       = "loopbridge-db-subnet"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]
  tags = { Name = "loopbridge-db-subnet" }
}

resource "aws_db_instance" "loopbridge" {
  identifier            = "loopbridge-db"
  engine                = "postgres"
  engine_version        = "16.3"
  instance_class        = "db.t4g.medium"  # Production: at least medium
  allocated_storage     = 100              # GB
  storage_type          = "gp3"
  multi_az              = true             # High availability
  publicly_accessible   = false            # Private subnet only
  
  db_name               = "loopbridge"
  username              = "lbadmin"
  password              = random_password.db_password.result  # Use Secrets Manager!
  
  skip_final_snapshot         = false
  final_snapshot_identifier   = "loopbridge-db-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  backup_retention_period     = 35  # AWS max
  backup_window              = "03:00-04:00"
  maintenance_window         = "mon:04:00-mon:05:00"
  
  db_subnet_group_name        = aws_db_subnet_group.loopbridge.name
  vpc_security_group_ids      = [aws_security_group.rds.id]
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  monitoring_interval             = 60  # CloudWatch enhanced monitoring
  monitoring_role_arn            = aws_iam_role.rds_monitoring.arn
  
  tags = { Name = "loopbridge-db" }
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "loopbridge/db-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id       = aws_secretsmanager_secret.db_password.id
  secret_string   = random_password.db_password.result
}
```

**Create new file: `infrastructure/terraform/cloudfront.tf`**:
```hcl
# CloudFront distribution for S3 media (HLS videos, thumbnails)
resource "aws_cloudfront_distribution" "s3_media" {
  origin {
    domain_name = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id   = "s3-uploads"
    s3_origin_config {}
  }

  enabled            = true
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-uploads"
    compress         = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 300    # 5 min for manifests
    max_ttl                = 604800 # 7 days for segments
  }

  cache_behaviors {
    path_pattern             = "*.m3u8"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "s3-uploads"
    viewer_protocol_policy   = "https-only"
    min_ttl                  = 0
    default_ttl              = 300    # Short TTL for live manifests
    max_ttl                  = 300
    compress                 = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions { geo_restriction { restriction_type = "none" } }
  viewer_certificate { cloudfront_default_certificate = true }

  tags = { Name = "loopbridge-media-cdn" }
}
```

**Create new file: `infrastructure/terraform/lambda.tf`**:
```hcl
# Lambda for transcode webhook callback (MediaConvert → app notification)
resource "aws_lambda_function" "transcode_callback" {
  filename      = "lambda/transcode-callback/index.zip"
  function_name = "loopbridge-transcode-callback"
  role          = aws_iam_role.lambda_transcode.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30

  environment {
    variables = {
      APP_WEBHOOK_URL = "https://${aws_instance.app.public_ip}:3000/transcode/webhook"
      WEBHOOK_SECRET  = var.transcode_webhook_secret
    }
  }
}

resource "aws_lambda_permission" "transcode_s3_invoke" {
  statement_id  = "AllowExecutionFromMediaConvert"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transcode_callback.function_name
  principal     = "events.amazonaws.com"
}
```

**Enhancements to `infrastructure/terraform/variables.tf`**:
```hcl
variable "environment" {
  description = "Environment name (prod, staging, dev)"
  default     = "prod"
}

variable "paystack_secret_key" {
  description = "Paystack API secret key"
  type        = string
  sensitive   = true
}

variable "flutterwave_secret_key" {
  description = "Flutterwave API secret key"
  type        = string
  sensitive   = true
}

variable "nowpayments_api_key" {
  description = "NOWPayments API key"
  type        = string
  sensitive   = true
}

variable "twilio_account_sid" {
  description = "Twilio Account SID"
  type        = string
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP server hostname"
  type        = string
}

variable "app_domain" {
  description = "App domain name (yourdomain.com)"
  type        = string
}

variable "enable_https" {
  description = "Enable HTTPS (requires cert in ACM)"
  type        = bool
  default     = true
}
```

**Usage**:
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars with your values
cat > terraform.tfvars <<EOF
aws_region                 = "us-east-1"
environment                = "prod"
paystack_secret_key        = "sk_live_..."
flutterwave_secret_key     = "FLWSECK_LIVE_..."
nowpayments_api_key        = "..."
twilio_account_sid         = "AC..."
smtp_host                  = "smtp.sendgrid.net"
app_domain                 = "yourdomain.com"
enable_https               = true
EOF

# Plan and review
terraform plan

# Apply (creates all resources)
terraform apply
```

---

## 6. Deployment Steps (Complete Walkthrough)

### 6.1 Phase 1: Infrastructure Setup (Terraform)

```bash
# 1. Create new AWS account
# 2. Set up AWS CLI credentials
aws configure

# 3. Clone LoopBridge repo
git clone https://github.com/yourusername/loopbridge.git
cd loopbridge

# 4. Initialize Terraform and deploy infrastructure
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# 5. Capture outputs (save these!)
terraform output -json > outputs.json
# Extract: EC2 public IP, RDS endpoint, S3 bucket, ECR repo URI, CloudFront URL
```

### 6.2 Phase 2: Database Setup

```bash
# 1. Get RDS endpoint from Terraform output
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)

# 2. SSH into EC2 bastion
EC2_IP=$(terraform output -raw ec2_public_ip)
ssh -i my-keypair.pem ec2-user@${EC2_IP}

# 3. Connect to RDS and verify (password from Secrets Manager)
psql postgresql://lbadmin@${RDS_ENDPOINT}:5432/loopbridge

# 4. Exit and verify connection works
\q
exit

# 5. Back on local, update server config with RDS endpoint
# Set env var: DATABASE_URL=postgresql://lbadmin:password@${RDS_ENDPOINT}:5432/loopbridge
```

### 6.3 Phase 3: Build & Push Docker Image

```bash
# 1. Authenticate Docker with ECR
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO=$(terraform output -raw ecr_repository_uri)

aws ecr get-login-password | docker login --username AWS --password-stdin $(echo $ECR_REPO | cut -d/ -f1)

# 2. Build Docker image
docker build -f server/Dockerfile -t loopbridge-api .

# 3. Tag and push
docker tag loopbridge-api:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest
```

### 6.4 Phase 4: Deploy to EC2

```bash
# 1. SSH into EC2
ssh -i my-keypair.pem ec2-user@${EC2_IP}

# 2. Pull latest image
ECR_REPO=$(aws ecr describe-repositories --repository-names loopbridge-api --query 'repositories[0].repositoryUri' --output text)
aws ecr get-login-password | docker login --username AWS --password-stdin $(echo $ECR_REPO | cut -d/ -f1)
docker pull ${ECR_REPO}:latest

# 3. Stop old container
docker stop loopbridge || true

# 4. Start new container with env vars from Secrets Manager
docker run -d \
  --name loopbridge \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL='postgresql://...' \
  -e PAYSTACK_SECRET_KEY='...' \
  -e S3_BUCKET='loopbridge-uploads-...' \
  -e S3_REGION='us-east-1' \
  ${ECR_REPO}:latest

# 5. Verify health
curl http://localhost:3000/health
```

### 6.5 Phase 5: DNS & SSL

```bash
# 1. Point domain to EC2 (or ALB/CloudFront)
# Create A record: yourdomain.com → EC2 public IP (or ALB DNS)

# 2. Install & configure SSL (via Let's Encrypt + nginx reverse proxy, or AWS Certificate Manager)
# Option A: Using Let's Encrypt with certbot on EC2
sudo yum install -y certbot python3-certbot-nginx
sudo certbot certonly --standalone -d yourdomain.com

# Option B: AWS Certificate Manager (recommended)
# Create cert in ACM, attach to ALB/CloudFront

# 3. Configure reverse proxy (nginx on EC2)
# Terminate SSL at nginx, forward to app on localhost:3000
sudo tee /etc/nginx/sites-available/loopbridge <<'EOF'
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
EOF

sudo systemctl restart nginx
```

### 6.6 Phase 6: Verify Deployment

```bash
# 1. Test frontend
curl https://yourdomain.com

# 2. Test API
curl https://yourdomain.com/api/courses

# 3. Test payment webhook
curl -X POST https://yourdomain.com/api/payments/webhook/paystack \
  -H "Content-Type: application/json" \
  -H "x-paystack-signature: test" \
  -d '{}'

# 4. Check logs
docker logs loopbridge | tail -20
tail -f /var/log/nginx/access.log

# 5. Monitor in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## 7. Critical Security Checklist

- [ ] Database password: stored in AWS Secrets Manager, **never** in `.env` file
- [ ] API keys (Paystack, Twilio, etc.): all in Secrets Manager
- [ ] EC2 security group: only ports 80, 443 open to public; SSH (22) restricted to your IP
- [ ] RDS security group: only port 5432 open to EC2 security group (not to public)
- [ ] S3 bucket: private (no public read), access via CloudFront only
- [ ] SSL/TLS: HTTPS enforced on all endpoints
- [ ] CORS: configured for your domain only (not `*`)
- [ ] Rate limiting: enabled on auth endpoints (10 req/min) and API endpoints (120 req/min)
- [ ] Input validation: all user inputs sanitized, SQL injection prevented
- [ ] CSRF protection: enabled for state-changing operations
- [ ] OWASP Top 10: reviewed and mitigated (SQL injection, XSS, CSRF, broken auth, etc.)

---

## 8. Go-Live Checklist

Before flipping to production:

- [ ] All environment variables configured in new AWS account
- [ ] Database backed up (RDS automated + manual snapshot)
- [ ] Payment gateways tested with real money (then refunded)
- [ ] Transactional emails tested (OTP, enrollment confirmation, newsletters)
- [ ] Video transcoding tested (upload video → verify all renditions)
- [ ] Analytics data flowing (check `/api/analytics/summary`)
- [ ] Admin panel fully functional (approvals, user management, promotions)
- [ ] Recommendation engine working (check `/api/recommendations/articles`)
- [ ] Load testing performed (at least 100 concurrent users)
- [ ] Smoke tests pass (all critical user journeys)
- [ ] Support team trained on admin panel + customer escalations
- [ ] Monitoring & alerts configured (errors, latency, disk space, RDS CPU)
- [ ] Rollback plan documented (how to revert if issues occur)
- [ ] Disaster recovery tested (restore from RDS snapshot)

---

## 9. Maintenance & Operations

### Daily
- [ ] Monitor error rate in CloudWatch
- [ ] Check RDS CPU usage
- [ ] Spot any payment webhook failures

### Weekly
- [ ] Review analytics summary
- [ ] Check for stuck MediaConvert jobs
- [ ] Test a manual database backup restore

### Monthly
- [ ] Review security logs
- [ ] Update dependencies (`npm audit`, `npm update`)
- [ ] Analyze user cohort retention
- [ ] Review cost breakdown (EC2, RDS, S3, CloudFront, MediaConvert)

### Quarterly
- [ ] Load test (ensure capacity for growth)
- [ ] Security audit (penetration test optional)
- [ ] Database optimization (VACUUM, ANALYZE)
- [ ] Review and optimize ML recommendation engine

---

## Summary Table

| Category | Status | Owner | Deadline |
|----------|--------|-------|----------|
| **Infrastructure (IaC)** | Ready | DevOps | Week 1 |
| **Database (RDS)** | Ready | DBA | Week 1 |
| **Payment Gateways** | Configured | Finance | Week 2 |
| **Email/SMS** | Configured | Product | Week 1 |
| **Video Transcoding** | Configured | DevOps | Week 1 |
| **Analytics** | Baseline ready | Data | Week 3 |
| **Recommendation Engine** | v1 ready | ML/Backend | Week 3 |
| **Frontend Build** | Ready | Frontend | Week 2 |
| **CI/CD Pipeline** | Partial | DevOps | Week 2 |
| **Monitoring & Logging** | Partial | DevOps | Week 2 |
| **Security Audit** | TBD | Security | Week 3 |
| **Load Testing** | TBD | QA | Week 3 |
| **Go-Live** | Targeted | Product | Week 4 |

---

**Next Steps**:
1. Assign owners to each category above
2. Create Jira tickets for each unchecked item
3. Run sprint planning to schedule work
4. Kick off infrastructure provisioning (Terraform)
5. Begin payment gateway live account setup
6. Finalize analytics & recommendation engine enhancements

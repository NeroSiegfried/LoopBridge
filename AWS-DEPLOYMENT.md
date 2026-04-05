# LoopBridge — AWS Deployment, Cost & Security Guide

> **Last updated**: April 2026
> **Audience**: Engineering team / solo developer deploying to AWS
> **Current stack**: Vanilla HTML/CSS/JS frontend · Node.js/Express backend · SQLite database

---

## Table of Contents

1. [Recommended AWS Architecture](#1-recommended-aws-architecture)
2. [Service-by-Service Decisions & Tradeoffs](#2-service-by-service-decisions--tradeoffs)
3. [Cost Estimates & Minimisation](#3-cost-estimates--minimisation)
4. [Security Hardening](#4-security-hardening)
5. [Feature & Architectural Suggestions](#5-feature--architectural-suggestions)
6. [Migration Checklist](#6-migration-checklist)

---

## 1. Recommended AWS Architecture

```
                     ┌──────────────┐
                     │  Route 53    │  DNS
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  CloudFront  │  CDN + HTTPS termination
                     └──┬───────┬───┘
                        │       │
           ┌────────────▼─┐  ┌──▼─────────────┐
           │  S3 Bucket   │  │  API Gateway   │
           │  (frontend)  │  │  (HTTP API)    │
           └──────────────┘  └──────┬─────────┘
                                    │
                             ┌──────▼───────┐
                             │  Lambda      │  Express app
                             │  (API)       │  via serverless-express
                             └──────┬───────┘
                                    │
                        ┌───────────┼───────────┐
                        │           │           │
                 ┌──────▼───┐  ┌────▼─────┐  ┌──▼─────────┐
                 │ DynamoDB │  │ S3       │  │ Lambda     │
                 │ (data)   │  │ (uploads)│  │ (media     │
                 └──────────┘  └──────────┘  │  compress) │
                                             └────────────┘
```

### Why this shape

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Frontend hosting | **S3 + CloudFront** | Zero-server, pennies/month, global edge caching, automatic HTTPS |
| API compute | **Lambda + API Gateway (HTTP API)** | Pay-per-request, zero idle cost, auto-scaling. Perfect for bursty community site |
| Database | **DynamoDB (single-table)** | Serverless, on-demand pricing, no connection-pool hassles with Lambda |
| File uploads | **S3** | Already the standard; integrates with media Lambda and CloudFront |
| Media compression | **Lambda (S3 trigger)** | No running cost when idle; sharp runs fine in Lambda for images |
| DNS | **Route 53** | Optional; only if you want AWS-managed DNS. Can use Cloudflare or Namecheap DNS too |

---

## 2. Service-by-Service Decisions & Tradeoffs

### 2.1 Frontend Hosting — S3 + CloudFront

**Chosen: S3 static hosting + CloudFront CDN**

| Alternative | Monthly Cost (est.) | Pros | Cons |
|-------------|--------------------:|------|------|
| **S3 + CloudFront** | **~$1–3** | Zero servers, global edge, auto HTTPS via ACM, cache invalidation | Slightly more setup; must configure OAC |
| S3 website hosting only | ~$0.50 | Simplest | No HTTPS on custom domain, no edge caching, no gzip/brotli |
| Amplify Hosting | ~$0–5 | Git-push deploys, preview URLs | Vendor lock-in, less control over caching |
| EC2/Lightsail | ~$5–20 | Full control | Overkill for static files; must manage server |

**Why S3 + CloudFront wins**: You're already building static HTML. CloudFront gives you HTTPS, HTTP/2, Brotli compression, and edge caching for essentially free at low traffic. The free tier covers 1 TB/month of data transfer and 10M requests/month.

---

### 2.2 API Compute — Lambda vs ECS vs EC2

**Chosen: Lambda (via API Gateway HTTP API)**

| Alternative | Monthly Cost (est.) | Cold Start | Scaling | Ops Burden |
|-------------|--------------------:|------------|---------|------------|
| **Lambda + HTTP API** | **~$0–5** (free tier: 1M req/mo) | 300–800ms (rare) | Auto (1000 concurrent default) | Near-zero |
| Lambda + ALB | ~$16 (ALB fixed) + per-req | Same | Same | Low |
| ECS Fargate (1 task) | ~$15–30 | None | Manual or auto-scaling | Medium |
| EC2 t4g.micro | ~$6 | None | Manual | High |
| App Runner | ~$5–15 | None | Auto | Low |

**Why Lambda wins for LoopBridge**:
- Crypto community traffic is **bursty** — spikes during market events, quiet otherwise
- Pay-per-invocation means **$0/month during quiet periods**
- No server to patch, no ECS task definitions to manage
- The Express app is already wrapped via `server/lambda.js`
- Cold starts are acceptable — users won't notice 500ms on first API call

**When to switch to ECS Fargate**:
- If you need persistent WebSocket connections (live chat, real-time prices)
- If cold starts become unacceptable (sustained >5s; unlikely with Node.js)
- If you exceed ~3M requests/month (Lambda cost > Fargate cost)

**Why NOT ALB**: The ALB alone costs ~$16/month just to exist (fixed hourly charge). API Gateway HTTP API has no fixed cost — purely pay-per-request at $1/million. For a site with <1M API calls/month, ALB is 16× more expensive.

---

### 2.3 Database — DynamoDB vs RDS vs Aurora Serverless

**Chosen: DynamoDB (on-demand)**

| Alternative | Monthly Cost (est.) | Lambda-friendly | Scaling | Ops Burden |
|-------------|--------------------:|:---------------:|---------|------------|
| **DynamoDB On-Demand** | **~$0–2** (25 GB free, 25 WCU/RCU free) | ✅ | Auto | None |
| DynamoDB Provisioned | ~$5–15 | ✅ | Manual | Low |
| RDS Postgres (db.t4g.micro) | ~$15 | ⚠️ (connection limits) | Manual | Medium |
| Aurora Serverless v2 | ~$0.12/ACU-hour (min $45/mo if always on) | ✅ (Data API) | Auto | Low |
| PlanetScale / Neon | ~$0 free tier | ✅ | Auto | None |

**Why DynamoDB wins**:
- **Zero connection management** — Lambda creates a new connection per invocation; DynamoDB uses HTTP, so no connection pooling needed. RDS with Lambda requires RDS Proxy (~$15/mo extra)
- **Free tier is generous**: 25 GB storage + 25 RCU/25 WCU per second is far more than LoopBridge needs
- **Single-table design** works well: articles, courses, users, sessions, FAQs, progress, uploads all fit in one table with composite keys
- On-demand pricing = $0 when nobody's using it

**Migration path from SQLite**:
- Replace the `repositories/` layer to use `@aws-sdk/lib-dynamodb` instead of `better-sqlite3`
- The service layer and routes stay identical (that's why we have the layered architecture)
- Design a partition key scheme: `PK=USER#uid SK=PROFILE`, `PK=ARTICLE#aid SK=META`, etc.

**When to use RDS instead**:
- If you need complex SQL queries (JOINs, aggregations, full-text search)
- If you plan a React rewrite with GraphQL (AppSync + RDS is a common pattern)
- Use **Aurora Serverless v2** with **RDS Data API** to avoid connection issues

---

### 2.4 File Storage & Media Processing

**Chosen: S3 for uploads + Lambda for image compression**

| Component | Service | Cost | Notes |
|-----------|---------|------|-------|
| Upload storage | S3 Standard | ~$0.023/GB/mo | Move cold uploads to S3-IA after 30 days via lifecycle rule |
| Image compression | Lambda + sharp | ~$0 | Triggers on S3 PutObject; 512 MB RAM, <5s per image |
| Video thumbnails | Lambda + ffmpeg layer | ~$0 | Extracts first frame only |
| Video transcoding | **MediaConvert** (if needed) | $0.024/min | Far better than Lambda for full video processing |
| CDN delivery | CloudFront | Included | Same distribution as frontend |

**S3 lifecycle policy** (saves money on old uploads):
```json
{
  "Rules": [{
    "ID": "ArchiveOldUploads",
    "Filter": { "Prefix": "uploads/" },
    "Transitions": [
      { "Days": 30, "StorageClass": "STANDARD_IA" },
      { "Days": 180, "StorageClass": "GLACIER_INSTANT_RETRIEVAL" }
    ],
    "Status": "Enabled"
  }]
}
```

---

### 2.5 API Gateway — HTTP API vs REST API

**Chosen: HTTP API**

| Feature | HTTP API | REST API |
|---------|----------|----------|
| Cost | $1.00/million requests | $3.50/million |
| Latency | Lower | Higher |
| JWT authorizers | ✅ Built-in | Requires Lambda authorizer |
| Usage plans / API keys | ❌ | ✅ |
| WebSocket | ❌ | ❌ (separate product) |
| WAF integration | ❌ | ✅ |

**Why HTTP API**: 3.5× cheaper, lower latency, JWT authorizer support. The only feature you'd miss is WAF integration — but you can put CloudFront in front of API Gateway and attach WAF to CloudFront instead.

---

### 2.6 Authentication — Cognito vs Custom

**Current: Custom session-based auth (cookie + server-side sessions)**

| Alternative | Monthly Cost | Pros | Cons |
|-------------|-------------|------|------|
| **Keep custom auth** | $0 | Full control, works now, simple | Must manage sessions in DynamoDB, no MFA/OAuth built-in |
| Cognito User Pools | $0 (first 50K MAU free) | MFA, OAuth, hosted UI, token-based | Complex, vendor lock-in, bad DX |
| Auth0 / Clerk | $0–25 | Great DX, social login | External dependency, paid at scale |
| Supabase Auth | $0 free tier | Open source, social login | Requires Supabase infrastructure |

**Recommendation**: Keep custom auth for now — it's working and simple. When you migrate to React, consider **Cognito** (if staying all-AWS) or **Clerk** (if you want good DX). For the current vanilla JS site, custom auth is the right choice.

**If keeping custom auth on AWS**: Store sessions in DynamoDB with a TTL attribute so they auto-expire. This replaces the SQLite sessions table and avoids stale session cleanup logic.

---

## 3. Cost Estimates & Minimisation

### Projected Monthly Costs (low traffic: <10K visitors/month)

| Service | Free Tier | Estimated Cost | Notes |
|---------|-----------|---------------:|-------|
| S3 (frontend + uploads) | 5 GB storage, 20K GET | **$0.10** | Mostly free tier |
| CloudFront | 1 TB transfer, 10M requests | **$0.00** | Well within free tier |
| API Gateway HTTP API | 1M requests/mo (12 months) | **$0.00** | Free tier covers it |
| Lambda | 1M requests, 400K GB-s | **$0.00** | Free tier covers it |
| DynamoDB On-Demand | 25 GB, 25 RCU/WCU/s | **$0.00** | Free tier covers it |
| Route 53 | — | **$0.50** | Per hosted zone |
| ACM (SSL cert) | — | **$0.00** | Free for CloudFront/ALB |
| **Total** | | **~$0.60/month** | |

### At Medium Traffic (~100K visitors/month)

| Service | Estimated Cost |
|---------|---------------:|
| S3 | $0.50 |
| CloudFront | $2–5 |
| API Gateway | $1–3 |
| Lambda | $1–3 |
| DynamoDB | $2–5 |
| Route 53 | $0.50 |
| **Total** | **~$7–17/month** |

### Cost Minimisation Tips

1. **Use the AWS Free Tier aggressively** — Lambda, DynamoDB, S3, CloudFront all have generous free tiers. A site under 1M requests/month is essentially free.

2. **Don't use an ALB** — $16/month fixed cost. Use API Gateway HTTP API ($1/million requests) instead.

3. **Don't use NAT Gateway** — $32/month minimum. Keep Lambda in public subnets or use VPC endpoints for DynamoDB ($0.01/GB).

4. **Use DynamoDB On-Demand** — Don't provision capacity. On-demand is cheaper below ~20K requests/day.

5. **S3 lifecycle rules** — Move old uploads to Infrequent Access after 30 days (40% cheaper).

6. **CloudFront caching** — Set long `Cache-Control` headers on static assets. Fewer origin requests = lower S3/Lambda costs.

7. **Lambda sizing** — Start at 256 MB RAM. Benchmark and tune. For the Express app, 256–512 MB is usually optimal (Lambda CPU scales with memory).

8. **ARM64 Lambda (Graviton)** — 20% cheaper and faster than x86. Node.js works great on ARM.

9. **Avoid Aurora Serverless v2** — Minimum cost is ~$45/month even when "scaled to zero" (it doesn't truly scale to zero). DynamoDB does.

10. **Use `@aws-sdk/client-*` v3** — Tree-shakeable, smaller Lambda bundles, faster cold starts.

---

## 4. Security Hardening

### 4.1 What's Already Implemented

| Measure | Location | Status |
|---------|----------|--------|
| **Security headers** (X-Content-Type-Options, X-Frame-Options, XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS in prod) | `server/index.js` | ✅ |
| **Rate limiting** (120 req/min general, 10 req/min auth) | `server/index.js` | ✅ |
| **X-Powered-By disabled** | `server/index.js` | ✅ |
| **httpOnly session cookies** | `server/routes/auth.js` | ✅ |
| **Password hashing** (bcrypt, 12 rounds) | `server/services/authService.js` | ✅ |
| **Parameterised SQL queries** (no string concatenation) | All `repositories/*.js` | ✅ |
| **XSS escaping** (`Utils.escapeHTML`) | Frontend rendering | ✅ |
| **Role-based access control** (admin / author / user) | `server/middleware/auth.js` | ✅ |
| **`includeDeleted` restricted to admin** | `server/routes/articles.js`, `courses.js` | ✅ |
| **File type validation** (MIME allowlist) | `server/services/storageService.js` | ✅ |
| **Upload size limits** (50 MB default) | `server/config/index.js` | ✅ |
| **JSON body size limit** | `server/config/index.js` | ✅ |
| **Graceful shutdown** (SIGTERM/SIGINT) | `server/index.js` | ✅ |

### 4.2 Additional Hardening Recommendations

#### A. Input Validation & Sanitisation

**Priority: HIGH**

Currently the API trusts `req.body` shapes. Add a validation layer:

```javascript
// Recommended: use 'zod' for runtime schema validation
// npm install zod
const { z } = require('zod');

const articleSchema = z.object({
    title: z.string().min(1).max(200).trim(),
    category: z.string().min(1).max(50).trim(),
    excerpt: z.string().max(500).optional(),
    content: z.array(z.object({
        type: z.enum(['heading', 'paragraph', 'list', 'blockquote', 'image']),
        value: z.string().max(10000),
    })).max(100),
    featured: z.boolean().optional(),
});
```

Add a middleware that validates `req.body` against schemas before the route handler runs. This prevents malformed data from reaching the database.

#### B. CSRF Protection

**Priority: MEDIUM** (already mitigated by SameSite=Lax cookies + CORS)

Current protection: `SameSite=Lax` cookies block cross-site POST requests from forms. CORS blocks cross-origin fetch. This is sufficient for an API-only backend (no server-rendered forms).

If you add server-rendered forms later, add a CSRF token:
```javascript
// npm install csrf-csrf
const { doubleCsrf } = require('csrf-csrf');
```

#### C. Content Security Policy (CSP)

**Priority: HIGH for production**

Add a Content-Security-Policy header to prevent XSS via injected scripts. Since LoopBridge uses Font Awesome kit, Google Fonts, and inline scripts, you need a tailored policy:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://kit.fontawesome.com https://ka-f.fontawesome.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.lineicons.com;
  font-src 'self' https://fonts.gstatic.com https://cdn.lineicons.com https://ka-f.fontawesome.com;
  img-src 'self' data: https:;
  connect-src 'self' https://ka-f.fontawesome.com;
  frame-ancestors 'none';
```

#### D. File Upload Hardening

**Priority: HIGH**

Beyond MIME type checking, validate actual file contents (magic bytes):

```javascript
// npm install file-type
const { fileTypeFromBuffer } = require('file-type');

async function validateUpload(buffer, declaredMime) {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected) throw new Error('Unable to determine file type');
    if (detected.mime !== declaredMime) throw new Error('MIME type mismatch');
    // Also block executable types
    const blocked = ['application/x-msdownload', 'application/x-executable'];
    if (blocked.includes(detected.mime)) throw new Error('File type not allowed');
}
```

Also consider:
- Scan uploads for malware via **Amazon GuardDuty S3 Protection** (auto-enabled in S3)
- Rename uploaded files to UUIDs (already done ✅)
- Serve uploads from a separate subdomain/S3 bucket so cookies aren't sent

#### E. AWS-Level Security

**Priority: HIGH when deploying**

| Measure | How | Cost |
|---------|-----|------|
| **WAF on CloudFront** | AWS WAF with managed rules (AWSManagedRulesCommonRuleSet, SQLi, XSS) | ~$6/month + $0.60/million requests |
| **CloudFront signed URLs** for private uploads | Generate pre-signed URLs with expiry for premium content | $0 |
| **DynamoDB encryption** | Enabled by default (AWS-managed keys) | $0 |
| **S3 Block Public Access** | Enable on all buckets; serve through CloudFront OAC only | $0 |
| **IAM least privilege** | Lambda role: only `dynamodb:*` on your table, `s3:*` on your bucket | $0 |
| **Secrets Manager** for API keys | Store DB passwords, JWT secrets, etc. | $0.40/secret/month |
| **VPC + Security Groups** | Only if using RDS; Lambda doesn't need a VPC for DynamoDB/S3 | $0 (but watch for NAT costs) |
| **CloudTrail** | Audit all API calls to your AWS account | Free (90-day, management events) |

#### F. Session Security Enhancements

**Priority: MEDIUM**

```javascript
// In auth routes, when setting the session cookie:
res.cookie(config.cookieName, sessionId, {
    httpOnly: true,
    secure: config.cookieSecure,           // true in production (HTTPS)
    sameSite: config.cookieSameSite,       // 'lax' or 'strict'
    maxAge: config.sessionTtlMs,
    path: '/',
    // Add when deploying:
    // domain: '.loopbridge.com',          // explicit domain
});
```

Also consider:
- **Session rotation** on privilege escalation (re-issue session ID after login)
- **IP binding** — store the originating IP in the session and reject if it changes (optional, can break mobile users)
- **DynamoDB TTL** for sessions — set a `ttl` attribute (epoch seconds) and DynamoDB auto-deletes expired sessions

#### G. Dependency Security

**Priority: ONGOING**

```bash
# Check for known vulnerabilities
npm audit

# Auto-fix
npm audit fix

# Pin exact versions in production
npm ci --omit=dev
```

Use **GitHub Dependabot** or **Snyk** for automated vulnerability alerts.

---

## 5. Feature & Architectural Suggestions

### 5.1 For the Crypto Community Platform

| Feature | Priority | Complexity | Description |
|---------|----------|------------|-------------|
| **Real-time price ticker** | High | Low | Embed a crypto price widget from CoinGecko or CoinMarketCap API. Free tier available. Display in navbar or hero section. |
| **Community forum / discussion** | High | High | Consider embedding Discourse (self-hosted) or using a third-party like Circle, Discord integration, or building a simple comments system per article. |
| **User profiles** | Medium | Medium | Public profile pages showing enrolled courses, progress, authored articles. Builds community identity. |
| **Course certificates** | Medium | Medium | Generate PDF certificates on course completion. Use `pdf-lib` or a headless browser. Good for engagement. |
| **Newsletter / email** | High | Low | Use **AWS SES** ($0.10/1000 emails) for the newsletter component. Currently the form doesn't submit anywhere. |
| **Search** | High | Medium | Full-text search across articles and courses. Options: DynamoDB + client-side filtering (free), OpenSearch (~$25/month), or Algolia (free tier: 10K searches/month). |
| **Bookmarks / reading list** | Low | Low | Let logged-in users save articles to a personal reading list (just a DynamoDB item per user). |
| **Article comments** | Medium | Medium | Simple comment system with moderation. Store as DynamoDB items linked to article IDs. |
| **Progress dashboard** | Medium | Low | User-facing page showing their enrolled courses, completion percentage, streak tracking. Already have backend support via progress table. |
| **Social login** | Low | Medium | "Login with Google/GitHub" via Cognito or a custom OAuth flow. Reduces friction. |
| **Dark mode** | Low | Low | CSS-only. Add a `data-theme="dark"` toggle and define dark CSS variables. |
| **Localisation (i18n)** | Low | High | Multi-language support. Important if targeting African crypto markets in multiple languages. |

### 5.2 Architectural Improvements

| Improvement | Priority | When |
|-------------|----------|------|
| **React migration** | Per your plan | When you're ready. The current API is already React-compatible (REST + JSON). |
| **TypeScript** | High | Add during the React migration. Type-safe API contracts prevent bugs. |
| **CI/CD pipeline** | High | GitHub Actions → build → deploy to S3/Lambda. Automate deployments from `main` branch. |
| **Infrastructure as Code** | High | Use **AWS CDK** (TypeScript) or **SAM** to define all AWS resources as code. Reproducible and auditable. |
| **API versioning** | Medium | Prefix routes with `/api/v1/` before you have external API consumers. |
| **Monitoring** | High | CloudWatch alarms on Lambda errors, 5xx rates, DynamoDB throttles. Free tier covers basic metrics. |
| **Error tracking** | High | Sentry free tier (5K events/month) for both frontend and backend error tracking. |
| **E2E testing** | Medium | Playwright or Cypress for critical user flows (login, course enrollment, article CRUD). |

### 5.3 React Migration Path

When you're ready to move to React:

1. **Keep the Express API as-is** — it's already a clean REST API
2. **Use Vite** for the React app (fast builds, good DX)
3. **React Router** for client-side routing (replaces the multi-page HTML structure)
4. **TanStack Query** for data fetching (caching, invalidation, optimistic updates)
5. **Move component HTML → JSX** one component at a time
6. **Deploy React build to S3** — same CloudFront distribution, just a new origin

The layered backend architecture (config → repos → services → routes) means **zero backend changes** are needed for the React migration.

---

## 6. Migration Checklist

### Phase 1: AWS Account Setup
- [ ] Create AWS account (or use existing)
- [ ] Enable MFA on root account
- [ ] Create IAM user/role for deployment
- [ ] Install AWS CLI + configure credentials
- [ ] Choose a region (recommend `us-east-1` for CloudFront, or `af-south-1` if targeting Africa)

### Phase 2: Frontend Deployment
- [ ] Create S3 bucket (e.g., `loopbridge-frontend`)
- [ ] Enable static website hosting
- [ ] Create CloudFront distribution with S3 OAC
- [ ] Request ACM certificate for your domain
- [ ] Configure Route 53 (or external DNS) to point to CloudFront
- [ ] Upload frontend files to S3
- [ ] Set `Cache-Control` headers (1 year for hashed assets, 5 min for HTML)

### Phase 3: API Deployment
- [ ] Create DynamoDB table (`loopbridge` with PK/SK)
- [ ] Run data migration script (SQLite → DynamoDB)
- [ ] Create S3 bucket for uploads
- [ ] Create Lambda function from `server/lambda.js`
- [ ] Set env vars: `DB_TYPE=dynamodb`, `STORAGE_DRIVER=s3`, `S3_BUCKET=...`
- [ ] Create API Gateway HTTP API
- [ ] Configure Lambda integration
- [ ] Configure custom domain on API Gateway
- [ ] Update frontend `DataService` base URL to API domain

### Phase 4: Media Processing
- [ ] Create Lambda from `server/lambda-media.js`
- [ ] Add sharp Lambda layer (or bundle)
- [ ] Configure S3 event trigger on uploads bucket
- [ ] Test with sample image upload

### Phase 5: Security
- [ ] Enable WAF on CloudFront (AWSManagedRulesCommonRuleSet)
- [ ] Enable S3 Block Public Access on all buckets
- [ ] Review IAM policies (least privilege)
- [ ] Enable CloudTrail
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Add CSP header to server response
- [ ] Configure SES for newsletter emails

### Phase 6: Monitoring & CI/CD
- [ ] Set up CloudWatch alarms (Lambda errors, 5xx, DynamoDB throttles)
- [ ] Create GitHub Actions workflow for deploy
- [ ] Add Sentry for error tracking
- [ ] Set up Dependabot for dependency updates

---

## Summary of Key Decisions

| Decision | Choice | Main Reason | Alternative if Needs Change |
|----------|--------|-------------|----------------------------|
| Frontend hosting | S3 + CloudFront | $0–3/month, global edge | Amplify (if you want git-push deploys) |
| API compute | Lambda + HTTP API | $0 at low traffic, no idle cost | ECS Fargate (if you need WebSockets) |
| Database | DynamoDB On-Demand | No connection issues with Lambda, $0 free tier | Aurora Serverless v2 (if you need SQL) |
| File storage | S3 | Standard choice, integrates with everything | EFS (if Lambda needs filesystem access) |
| Media processing | Lambda + sharp | Free at low volume, event-driven | MediaConvert (for video transcoding) |
| Auth | Custom sessions | Works, simple, no vendor lock-in | Cognito (when you need MFA/OAuth) |
| CDN | CloudFront | Same ecosystem, free tier generous | Cloudflare (if you want free WAF) |
| IaC | AWS CDK (recommended) | TypeScript, same language as app | SAM or Terraform |

**Total estimated monthly cost at launch: $0.60–$3.00** (within free tier limits for first 12 months, ~$7–17/month after free tier or at moderate traffic).

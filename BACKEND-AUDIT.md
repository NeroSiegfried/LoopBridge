# LoopBridge — Backend Audit

_Date: June 2026 · Scope: `server/` (Express + dual-driver SQLite/Postgres)_

Overall the backend is **well-architected**: a clean `routes → services → repositories`
layering, centralised `config`, parameterised SQL everywhere (no injection found),
bcrypt password hashing, httpOnly session cookies, security headers, and per-route rate
limiting on auth. The issues below are mostly hardening and a few real correctness bugs in
the payments webhook path.

Legend: ✅ **Fixed in this pass** · 🔶 **Proposed (needs your approval / testing)** · 📝 **Note / observation**

---

## 1. Security

### ✅ Duplicate route block in `routes/auth.js` (FIXED)
The entire set of auth routes (`/login`, `/google`, `/otp/send`, `/otp/verify`, `/logout`,
`/session`) plus `module.exports` was **defined twice**. The second copy re-registered every
route **without** the rate limiters and re-declared `setSessionCookie`. Express runs the
first-registered handler, so the rate-limited versions won won — but the duplicate was dead,
confusing code that would eventually cause a real bug (e.g. if someone edited the "second"
login). Removed the duplicate; kept the rate-limited definitions.

### ✅ Webhook raw-body capture (FIXED — webhooks were 100% broken)
`paymentService` verifies provider webhooks by computing an HMAC over the **raw** request
bytes. But the global `express.json()` parsed (and consumed) the body **before** the payment
router's per-route `express.raw()` could run, so `req.rawBody` was always empty and **every
webhook signature check failed**. Fixed by capturing the raw buffer in the global parser
(`express.json({ verify })`) and reading `req.rawBody` in the webhook routes.

### ✅ `trust proxy` in production (FIXED)
`req.ip` is used as the rate-limit key and to decide `Secure` cookies. Behind an ALB without
`app.set('trust proxy', …)`, `req.ip` is the proxy's address, so rate limiting is global
(one client can lock out everyone) and proxy-terminated TLS isn't detected. Enabled
`trust proxy: 1` in production only.

### 🔶 Payment webhook signature **schemes** are provider-incorrect
Now that raw body flows through, Paystack should verify correctly (HMAC-SHA512 of raw body ✓).
But two providers use a different scheme than the code assumes:
- **Flutterwave** — the `verif-hash` header is a **static secret hash** you set in the
  dashboard; you compare it to your stored secret. The code instead computes
  `HMAC-SHA256(rawBody)` and compares to the header → will **never** match.
  _Fix:_ compare `req.headers['verif-hash']` to a configured `FLW_WEBHOOK_HASH`.
- **NOWPayments** — the IPN signature is `HMAC-SHA512` of the **JSON with keys sorted
  alphabetically**, not the raw body. _Fix:_ sort keys, then HMAC.

I did **not** change `paymentService` here because these need to be validated against live
provider payloads. Patches ready on request.

### 🔶 `GET /api/uploads/:id` has no auth guard
Returns upload metadata to anyone. Low severity (metadata only, and content is already served
statically), but inconsistent with `GET /api/uploads` (author-only). Suggest adding
`requireAuth`. Left unchanged to avoid breaking any unauthenticated caller — confirm and I'll add it.

### 🔶 Re-assert amount on payment verification
`verifyAndEnroll` trusts the provider's "success" status but doesn't assert that the amount
paid equals `course.price`. The amount is server-set at initiate, so risk is low, but adding
`provider.amount === course.price` is cheap defence-in-depth.

### 📝 Lower-priority hardening
- **OTP codes stored in plaintext** (`otp_codes.code`). Consider hashing at rest; codes are
  short-lived and rate-limited, so this is minor.
- **Login user-enumeration via timing** — `findByUsername` returns before `bcrypt.compare`
  when the user doesn't exist. Optionally run a dummy compare to equalise timing.
- **CSRF** — auth is cookie-based with `SameSite=Lax`, which blocks the common CSRF vectors.
  If you ever embed the app cross-site, add CSRF tokens or move state-changing calls to a
  custom header the browser won't send cross-site.
- **Dev OTP echo** — `sendOtp` returns the code when `NODE_ENV !== 'production'`. Make sure
  prod actually sets `NODE_ENV=production`.
- ✅ **Secrets verified gitignored** — `.env`, `*.pem`, `secrets.env`, `CREDENTIALS.local.md`
  are all in `.gitignore`. Good. (Worth a one-time `git log`/`git secrets` check that none
  were committed before the ignore rules existed.)

---

## 2. API design & consistency

- 📝 **Two rate-limiting systems coexist.** A hand-rolled in-memory limiter in `index.js`
  (keyed by `ip + baseUrl`) and `express-rate-limit` inside `routes/auth.js`. They overlap on
  `/api/auth`. Recommend consolidating on `express-rate-limit` everywhere for consistent
  headers/behaviour.
- 📝 **In-memory limiter won't scale.** Both the hand-rolled map and `express-rate-limit`'s
  default memory store are **per-process** — ineffective across multiple instances or Lambda
  cold starts. For production multi-instance, back them with Redis (e.g. `rate-limit-redis`).
- ✅ **Consistent error envelope** (`{ error }`) and `err.status` mapping across routes — good.
- ✅ Added `GET /api/glossary` consistent with `site`/`team`/`platforms`.

---

## 3. Error handling & resilience

- 🔶 **No timeout on outbound provider calls.** `paymentService.apiRequest` (raw `https`) has
  no timeout — a hung Paystack/Flutterwave/NOWPayments connection will hang the user's request.
  Add `req.setTimeout(…)` + `req.destroy` on timeout (patch ready).
- ✅ Global error handler returns a generic 500 (doesn't leak internals) and logs server-side.
- ✅ Graceful shutdown (SIGTERM/SIGINT), `EADDRINUSE` guidance, stale rate-limit cleanup — solid.

---

## 4. Performance & queries

- ✅ Good index coverage on hot tables (`payments`, `analytics_events`, `messages`,
  `otp_codes`, `subscribers`).
- ✅ **Static JSON now cached** (`misc.js`) — `readStaticJSON` memoises in production, so
  `site`/`team`/`platforms`/`glossary` aren't re-read from disk on every request.
- 📝 Sessions are validated with a DB round-trip on every request (`sessionMiddleware`). Fine
  for current scale; if it becomes hot, cache valid sessions briefly in memory/Redis.

---

## 5. Code organization / maintainability

- ✅ Strong layered architecture; services contain no HTTP concepts; repositories are pure
  data access. This is the codebase's biggest strength.
- 📝 **`db.js` keeps two full hand-written schemas** (PG + SQLite) plus a `normaliseSql`
  string-rewriter. It works, but the regex rewriting (`INSERT OR REPLACE` → `ON CONFLICT`,
  `datetime('now')` → `NOW()`) is fragile for any complex query. Consider a thin query
  builder or keeping one canonical schema generated per-dialect.
- 📝 Several repos embed `datetime('now')` in SQL strings; the PG driver rewrites it, but a
  shared `db.now()` helper would make intent clearer and remove a rewrite dependency.

---

## 6. Data integrity & validation

- ✅ `CHECK` constraints on `role` and payment/promotion `status`; foreign keys with sensible
  `ON DELETE` rules; `UNIQUE` on `username`, `email`, `payments.reference`.
- 🔶 **Request-body validation is ad-hoc** (manual `if (!x)` checks per route). For the
  write-heavy endpoints — `POST/PUT /articles`, `/courses`, `/profile` — a shared schema
  validator (e.g. `zod`) would catch malformed/oversized payloads consistently and shrink the
  controllers. Happy to introduce it incrementally.

---

## Summary of changes made in this pass

| File | Change | Risk |
|---|---|---|
| `server/routes/auth.js` | Removed duplicated route block | None (dead code) |
| `server/index.js` | `trust proxy` (prod) + capture `req.rawBody` in `express.json` | Low |
| `server/routes/payments.js` | Use captured `req.rawBody`; removed broken per-route raw parser | Low |
| `server/routes/misc.js` | Added `GET /api/glossary`; cache static JSON in prod | Low |

## Recommended next (your call)
1. Fix Flutterwave + NOWPayments webhook signature schemes (provider-correct).
2. Add `requireAuth` to `GET /api/uploads/:id`.
3. Add timeouts to outbound payment provider calls.
4. Assert paid amount == course price on verify.
5. Consolidate rate limiting (+ Redis store for multi-instance).
6. Introduce `zod` validation on write endpoints.

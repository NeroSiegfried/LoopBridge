# LoopBridge — Change Log (work in this project)

This project mirrors your codebase. **Only new/changed files live here**, at the same
relative paths as your repo, so you can drop them straight in. Each entry notes exactly
what changed and why.

---

## ✅ Phase 1 — Glossary page (the "missing FAQ/Glossary" page)

Faithful build of the Figma **Glossary** symbol (`node 1641:15593`): light-green hero with
the a–z illustration, a two-column body (sticky A–Z index + search on the left, grouped
definitions panel on the right), full keyboard/scroll behaviour, search filtering, and
click-to-jump with a highlight flash.

### New files
| File | Purpose |
|---|---|
| `client/src/pages/Glossary.jsx` | The page (SEO, fetch, search, grouping, jump-to-term) |
| `client/src/styles/glossary.css` | Styles, built on your existing CSS tokens; responsive |
| `data/glossary.json` | 63-term A–Z dataset (original concise definitions, covers all Figma terms + more) |
| `client/public/images/glossary-illustration.png` | Hero illustration, exported from Figma |

### Changed files
| File | Change |
|---|---|
| `server/routes/misc.js` | Added `GET /api/glossary` (reads `glossary.json`, mirrors site/team/platforms pattern). Also added a small prod-only static-JSON cache. |
| `client/src/api.js` | Added `miscApi.glossary()` |
| `client/src/App.jsx` | Added `import Glossary` + `<Route path="glossary" …>` |
| `client/src/pages/Academy.jsx` | "Browse Glossary" now links to `/glossary` (was a "coming soon" link to `/articles`) |

Built from BOTH Figma dev frames — desktop symbol `1641:15593` **and** the mobile frame
`1778:23348` (the authoritative one):
- **Hero is dark navy `#013352`** with white heading + `#f2f4f6` subtitle (the pale-green
  desktop draft was stale — navy is why the text is white).
- **Mobile shows the 26-letter filter card** (`#f9fafb`, 9/9/8 grid, unavailable letters
  greyed) with the search inside it; tapping a letter filters the glossary. Definitions sit
  on a `#fafffc` background with no panel card — exactly per the mobile frame.
- Desktop keeps the vertical A–Z term index + gray definitions panel.
- Type/spacing colours taken verbatim from the Figma components (letter header Cabinet
  Medium 28 `#013352`; term name Schibsted Medium 18 `#444b54`; definition 16 `#1e1e1e`;
  no dividers).

### Notes
- **Glossary data.** 63 original plain-language definitions (Account → Yield Farming). Kept
  as static JSON (matches your `site.json`/`team.json`); easy to move into the DB later.
- **Not added to the top nav** — Figma reaches the Glossary from the Academy "Learning
  Pathways" card, so I wired it there.

---

---

## ✅ Phase 2 — Backend audit + low-risk fixes

Full write-up in **`BACKEND-AUDIT.md`**. Headline: the backend is well-architected
(clean layering, parameterised SQL, bcrypt, security headers). Real bugs found & fixed,
plus a list of proposals that need your sign-off.

### Changed files
| File | Change |
|---|---|
| `server/routes/auth.js` | Removed an entire **duplicated** route block (the copy bypassed the rate limiters) |
| `server/index.js` | `trust proxy` in prod + capture `req.rawBody` so payment webhooks can verify signatures |
| `server/routes/payments.js` | Use the captured `req.rawBody`; removed the broken per-route raw parser |
| `server/routes/misc.js` | (from Phase 1) `GET /api/glossary` + prod cache for static JSON |

### Most important findings
- 🐞 **Payment webhooks were fully broken** — `express.json()` consumed the body before
  signature verification could read the raw bytes. Fixed.
- 🐞 **`auth.js` route block duplicated** — dead/confusing code; the duplicate skipped rate
  limiting. Fixed.
- 🔶 **Flutterwave & NOWPayments webhook signature *schemes* are provider-incorrect** (even
  after the raw-body fix). Documented with patches — left for you to approve + test against
  live payloads.
- 🔶 Smaller items: `GET /api/uploads/:id` auth, outbound-call timeouts, amount re-check on
  verify, consolidating rate limiting, `zod` validation on write endpoints.

---

## ✅ Phase 3 — Mobile spacing audit (page by page)

Systematically compared each page vs Figma mobile frames + site spacing tokens.
Focus: fit more info as screens shrink — reduce font sizes, vertical padding, and gaps.

| File | Changes |
|---|---|
| `home.css` | Hero h1 **3rem→38px** at mobile (Figma value); hero p **16px/24px**; `why`/`join` h2 **60px→32px** (never reduced before); section paddings tightened; newsletter **10rem→3.5rem**; duplicate `@media` block consolidated |
| `about.css` | Hero **padding-bottom 160px→2.5rem**; heading **margin-bottom 140px→2rem** at mobile |
| `academy.css` | Hero h1 **48px→38px** at mobile; hero p **16px**; pathways h2 **40px→28px**; intro/philosophy font + padding reduced |
| `exchange.css` | Hero h1 **48px→36px**; section h2s **40px→32px**; hero p **16px**; active step padding **40px→20px** |
| `community.css` | Hero h1 **60px — never reduced before**, now **38px**; hero p **16px**; padding-bottom **160px→3rem**; pathways vertical reduced; platforms margin-top reduced |
| `courses.css` | Hero h1 **48px→38px**; hero p **16px** |
| `faqs.css` | Section padding-bottom halved; categories gap **50px→1.75rem** |
| `blog.css` | Hero padding-bottom **8rem→3rem** at mobile |
| `legal.css` | Full mobile fix: hero **200px→var(--page-top)**; banner **140px→2rem**; h1 **52px→36px**; body text **20px→16px**; side padding **60px→20px** |
| `course_overview.css` | Removed **misplaced `.legal-hero` rules** (copy-paste artifact from legal.css) |

### Unchanged / already well-handled
- `lesson.css`, `learning_track.css` — use `var(--page-top)` correctly, good 768/480 breakpoints.
- `login.css` / `signup.css` — single-column collapse at 48rem, token-based top padding.
- `profile.css` — lightweight, no issues.
- `articles.css` — well-handled, clamp-based values.

---

## ⏳ Remaining
- **Frontend fidelity doc** — detailed page-by-page comparison notes (Figma vs implementation). Most critical gaps now fixed.
- **Your new pages** (full Figma fidelity pass): admin dashboard, edit article/course — no Figma designs, so design-language consistency check only.
- **Backend proposals awaiting approval** (Flutterwave/NOWPayments webhook fix, uploads auth, payment amount check, rate-limit Redis).

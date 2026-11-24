# 🩺 Sweety – Blood Glucose Tracker

Sweety is a blood glucose tracking web application designed for diabetes patients to log up to 4 readings a day (`morning_fasting`, `after_breakfast`, `after_lunch`, `after_dinner`) and monitor glycemic control through daily and monthly reports.

---

## 🛠️ Tech Stack (Phase 1: Backend & Security)

- **Runtime & Framework:** Node.js (CommonJS), Express
- **Database:** PostgreSQL 16 (Local Docker container / Cloud Supabase ready)
- **Database Driver:** `pg` (`pg.Pool` connection pooling)
- **Password Hashing:** `argon2` (Argon2id profile, OWASP recommended)
- **Token Management:** `jsonwebtoken` (strict HS256, issuer/audience validation)
- **Security Middlewares:** `helmet`, `cors`, `cookie-parser`, `express-rate-limit`
- **Validation:** `zod`
- **Testing:** Jest, Supertest, `pg-mem`

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ or v22+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local PostgreSQL)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
cp server/.env.example server/.env
```

### 3. Start PostgreSQL with Docker
Start Docker Desktop on your system, then launch the database container:
```bash
docker compose up -d db
```
To verify the database container is healthy:
```bash
docker ps
```

### 4. Run Database Migrations & Seed Demo User
Apply the PostgreSQL schema (creates `users` and `refresh_tokens` tables):
```bash
npm run db:migrate
```
Populate demo user (`demo@sweety.dev` / `Demo1234!`):
```bash
npm run db:seed
```

### 5. Run Automated Tests
Execute backend and frontend test suites:
```bash
# Run backend integration test suite (142 tests)
npm test

# Run frontend React Testing Library & API client test suite (11 tests)
npm run test:client
```

### 6. Start Development Servers
Start both backend API and frontend Vite client:
```bash
# Terminal 1: Start Express API server (http://localhost:5000)
npm run server

# Terminal 2: Start React Vite frontend client (http://localhost:5173)
npm run client
```

### 7. Production Build
```bash
# Build optimized client bundles (dist/assets/)
npm run build
```

---

## 📖 Architecture & Design Documentation

For complete architectural specifications, threat modeling, and contracts, consult:
- [ARCHITECTURE.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/ARCHITECTURE.md) – System architecture and layered design.
- [SECURITY.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/SECURITY.md) – Comprehensive threat model, auth lifecycle, CSRF, and hardening.
- [DECISIONS.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/DECISIONS.md) – Architectural Decision Records (ADRs).
- [DATABASE.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/DATABASE.md) – Relational schema, indexes, and constraints.
- [API_SPEC.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/API_SPEC.md) – Auth and session REST API contracts.
- [AGENTS.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/AGENTS.md) – Operating guidelines for AI coding agents.
- [working/README.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/README.md) – Complete Phase 1 working documentation, cryptographic threat models, library breakdowns, and senior engineering interview preparation.

---

## 📝 Notes

### Assumptions
- **Date & Timezone Integrity**: Storing timestamps with standard UTC serialization causes local dates to shift across midnight (e.g. 11:30 PM local shifting backwards to the previous date). All glucose reading calendar dates will be stored strictly as ISO `YYYY-MM-DD` strings mapped to PostgreSQL `DATE` types without timezone mutation.
- **Argon2id Password Hashing**: While the initial prompt mentioned bcrypt, modern OWASP and IETF (RFC 9106) guidelines mandate Argon2id due to memory-hardness that defends against GPU/ASIC password cracking. We adopted Argon2id across all user authentication.
- **httpOnly Cookie-Based Auth vs localStorage**: Storing tokens in `localStorage` or returning them in JSON exposes tokens to XSS exfiltration. Access tokens (10m) and refresh tokens (7d) are stored exclusively in `httpOnly`, `Secure` (in production), `SameSite=Lax` cookies.
- **Refresh Token Rotation & Reuse Detection**: To protect against stolen refresh tokens, each refresh operation invalidates the presented token and issues a fresh one. If an already-revoked refresh token is presented, the system detects a breach and invalidates all active sessions for that user. Token rotation is performed via an atomic `UPDATE ... WHERE id = $2 AND revoked_at IS NULL RETURNING id` statement; concurrent attempts are serialized, preventing multiple token branches and detecting race-condition reuse immediately.
- **RFC 6265bis Secure Cookie Clearing**: Cookies set with the `Secure` flag under HTTPS must also have the `Secure` flag when cleared. Cookie clearing utilities strictly mirror issuance parameters (`path`, `secure`, `sameSite`) so browsers do not reject cookie deletion upon logout.
- **Dual `.env` Configuration Resolution**: Environment configuration loads variables from the repository root `.env` (consistent with Docker Compose defaults) while permitting `server/.env` overrides, preventing unconfigured fallback failures during development.
- **Database Primary Keys**: Primary keys use standard SQL:2003 `BIGINT GENERATED BY DEFAULT AS IDENTITY` rather than legacy PostgreSQL `SERIAL` sequences to prevent sequence idiosyncrasies and ensure 100% compatibility with Supabase.
- **Double Submit Cookie CSRF Protection**: Because authentication relies on ambient browser cookies, mutating HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an `X-CSRF-Token` header matching the issued `csrfToken` cookie with constant-time comparison.
- **Indian Standard Time (`Asia/Kolkata`) Date Anchor**: Future date validation evaluates calendar boundaries against Indian Standard Time (`Asia/Kolkata`, UTC+5:30). A reading submitted after midnight IST (e.g. 12:05 AM IST) is accepted for that calendar date even when UTC is still on the previous day.
- **Node-Postgres `DATE` Column Parsing (Type OID 1082)**: By default, `pg` converts `DATE` columns to JavaScript `Date` objects at local midnight, causing 1-day backward timezone shifts when serialized via `.toISOString()`. To eliminate timezone shifts, `pg.types.setTypeParser(1082, (val) => val)` is configured globally to return raw `YYYY-MM-DD` calendar strings.
- **Self-Exclusion on Reading Updates**: When updating (`PUT` or `PATCH`) a reading on a day that already has 4 readings, the count and slot conflict queries explicitly exclude the current record (`WHERE id != $id`), preventing false rejections while maintaining strict daily limits and uniqueness.
- **Multi-Tenant Row-Level Data Isolation**: All reading queries strictly scope operations by `WHERE user_id = $userId`. Attempts to access or mutate records belonging to other users return `404 Not Found`, completely preventing Insecure Direct Object Reference (IDOR) attacks and preventing leakage of record existence.
- **Numerical Route Identifier Bounds Validation**: Route parameters (`/api/readings/:id`) are validated using `isValidId(id)` prior to SQL execution. Malformed IDs (strings, negatives, zero, integers exceeding PostgreSQL 64-bit signed BIGINT limits) cleanly return `404 Not Found`, eliminating database execution exceptions (`22P02`, `22003`) and preventing internal stack leakage.
- **Query Calendar Date Preprocessing & Whitespace Parity**: Query parameters (`GET /api/readings?date=...`) enforce `isValidDateString` validation to reject non-existent calendar dates (e.g. `2026-02-31`) with HTTP 422 rather than throwing database overflow errors (`22008`). Empty query strings gracefully fallback to pagination defaults, and whitespace-only glucose values (`"   "`) consistently trigger `"Please enter a glucose value."`.
- **Deterministic Report Date Math & Leap Year Resolution**: Reporting date boundaries for `monthly` (whole previous month) and `month_to_date` (1st to selected date) are computed using integer calendar UTC date math (`new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()`). This deterministically accounts for leap year February boundaries (29 days in 2024 vs 28 days in 2025) and December rollovers when querying January, without timezone drift.
- **Reporting Statistical Aggregations & Division-by-Zero Safety**: Summary metrics (`highest`, `lowest`, `average`, `count`) are calculated directly via SQL aggregate functions with row-level tenant scoping (`WHERE user_id = $1 AND date >= $2 AND date <= $3`). Standard arithmetic rounding to 1 decimal place (`Math.round(val * 10) / 10`) is applied to `average`. For periods with 0 readings, the endpoint cleanly returns `stats: { count: 0, highest: null, lowest: null, average: null }` and `readings: []` without division-by-zero crashes or `NaN` outputs.
- **Circadian Meal Slot Chronological Ordering**: In daily reports, readings are returned sorted in clinical circadian meal order (`morning_fasting` → `after_breakfast` → `after_lunch` → `after_dinner`) via SQL `CASE` ordering, ensuring the UI displays a patient's daily timeline in chronological sequence regardless of the order entries were logged.
- **Express Prototype Getter Shadowing on Query Validation**: In Express, `req.query` is configured with a prototype getter. Mutating `req[source] = parsed` during schema boundary validation could not attach transformed/defaulted Zod outputs. The `validate` middleware shadows the getter using `Object.defineProperty(req, source, { value: parsed, writable: true, configurable: true, enumerable: true })`, ensuring query defaults (such as defaulting date to today in IST) bind seamlessly across all endpoints.
- **Frontend Single-Flight Refresh Mutex & Concurrency Barrier**: When multiple HTTP requests encounter an expired 10-minute access token (`401 Unauthorized`), uncoordinated concurrent calls to `/api/auth/refresh` would present the same rotated refresh token in parallel. The server's atomic token rotation detects this as token reuse and emergency-revokes all active sessions for that user. To prevent false breach triggers, `client/src/services/api.ts` implements a Single-Flight Mutex: exactly one `/api/auth/refresh` request is initiated, all concurrent 401s queue behind its returned promise, the freshly rotated CSRF and session cookies are captured, and all queued requests are seamlessly retried.
- **Hallmark "Clinical Calm" Design System & WCAG 2.2 AA Conformance**: Built with zero "AI aesthetic" defaults: all color tokens and font scales are declared at `:root` in `src/index.css`. Transitions avoid `transition: all` and strictly animate `transform` and `opacity`. Mobile ergonomics mandate 44x44px minimum touch targets and sticky bottom navigation for thumb reachability. American Diabetes Association (ADA) target boundaries are displayed via clinical color tokens: In Target (emerald), Borderline (amber), High (crimson), and Low (slate blue) with 100% accessible contrast.
- **Exact Client-Side Validation Parity**: The reading entry form executes identical validation checks before initiating network roundtrips, giving immediate tactile feedback matching assignment specifications verbatim: `"Please enter a glucose value."`, `"Value must be between 40 and 600 mg/dl."`, `"Date cannot be in the future."`, `"You already have an {Slot Name} reading for this date."`, and `"You can add only 4 readings per day."`.
- **Mobile Numeric Input Keypad & Input Normalization**: Glucose values use `<input type="text" inputMode="numeric" pattern="[0-9]*" />` with `/^\d+$/` validation instead of standard `<input type="number">`. This invokes the native numeric keypad on mobile devices, eliminates desktop spinner side-effects, prevents jsdom empty-value normalization bugs, and seamlessly handles trimmed inputs (`" 120 "` -> `120`).
- **Date-Scoped Form Validation**: Client-side slot collision and max-4 count checks in `ReadingModal` evaluate against the selected date only if `date === initialDate`. If the patient changes the date inside the modal, collision validation is delegated to the server's HTTP 409 conflict checks, preventing false lockouts when navigating from a full day.
- **Multi-Page Chronological Aggregation for Trend Charts**: Reporting trend charts paginate through all available reading pages (up to `totalPages`) and sort chronologically by calendar date and circadian slot order (`morning_fasting` → `after_breakfast` → `after_lunch` → `after_dinner`), ensuring the full 120-reading monthly curve of seeded accounts is accurately visualized without truncation.

### What I'd Improve with More Time
- **Structured Logging (Winston / Pino)**: Upgrade native `console.log` to Winston with log levels, request correlation IDs, daily log rotation, and automated clinical data redaction (detailed in [future_plans.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/future_plans.md)).
- **Distributed Redis Rate Limiting**: The current rate limiter uses an in-memory store. In a multi-instance production cluster, this would be backed by Redis for synchronized distributed rate limiting.
- **Multi-Factor Authentication (MFA / TOTP)**: Add opt-in two-factor authentication (e.g. via Authenticator apps) for sensitive clinical accounts.
- **WebAuthn / Passkeys**: Support biometric passkey logins (FaceID / TouchID / Windows Hello) for faster and phishing-resistant authentication.
- **Redis Report Caching**: Cache aggregated daily/monthly reports in Redis with automatic invalidation upon reading creation, update, or deletion.

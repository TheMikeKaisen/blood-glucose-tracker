# 🛡️ Sweety – Security Architecture & Hardening Guide

This document defines the comprehensive security architecture, threat model, and security controls enforced across the Sweety application.

---

## 1. Threat Model & Security Posture

Sweety is a clinical blood glucose tracking application. Health data is sensitive and personal. Protecting user identities, credentials, and health records requires **defense-in-depth**: multiple overlapping security controls such that the failure of any single barrier does not compromise user data.

### Threat Vectors & Mitigations

| Threat Vector | Potential Impact | Enforced Mitigation |
|---|---|---|
| **Credential Stuffing / Brute Force** | Account takeover via dictionary attacks | Argon2id password hashing + strict rate limiting on `/login` and `/register` endpoints |
| **XSS Token Theft** | Exfiltration of session tokens | Access tokens stored exclusively in `httpOnly`, `Secure`, `SameSite=Lax` cookies; tokens never exposed in JSON responses or `localStorage` |
| **Refresh Token Theft** | Long-lived unauthorized session access | Refresh Token Rotation on every exchange; tokens stored solely as SHA-256 hashes; automatic Reuse Detection revoking all user sessions upon breach |
| **Cross-Site Request Forgery (CSRF)** | Unauthorized mutations via browser ambient credentials | Double Submit Cookie pattern; state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require matching `X-CSRF-Token` header |
| **SQL Injection** | Database takeover / data leakage | 100% parameterized SQL queries (`$1, $2, ...`) via `pg`; zero dynamic string concatenation |
| **Insecure Direct Object Reference (IDOR)** | User viewing or editing another patient's readings | Hard multi-tenant isolation enforced in database queries (`WHERE user_id = $1`) on all read/write operations; returns 404 on mismatched user IDs |
| **Race Conditions / Duplicate Submissions** | Bypassing slot or daily count limits via parallel requests | PostgreSQL table constraint `UNIQUE(user_id, date, slot)` with controller error trapping (`code === '23505'`) |
| **Information Disclosure** | Attackers exploiting stack traces or schema info | Centralized error handler suppressing stack traces and raw SQL errors in production; standardized error envelopes |
| **Denial of Service (DoS)** | Exhaustion of server resources | Payload size limits (`10kb`), rate limiting, connection pooling with bounded limits |

---

## 2. Authentication & Credential Architecture

### 2.1 Password Hashing: Argon2id
- **Algorithm:** Argon2id (RFC 9106), the current OWASP recommendation and winner of the Password Hashing Competition.
- **Why Argon2id over Bcrypt / PBKDF2:** Argon2id provides superior resistance against both GPU/ASIC brute-force attacks (memory-hardness) and side-channel timing attacks.
- **Parameters:**
  - Memory cost: `65536 KB` (64 MB)
  - Time cost: `3` iterations
  - Parallelism: `4` threads
- **Minimum Requirements:** Passwords must be at least 8 characters long.

### 2.2 Short-Lived JWT Access Tokens
- **Lifespan:** 10 minutes (`10m`).
- **Storage:** Stored exclusively in an `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookie named `accessToken`.
- **Claims:**
  - `sub`: User ID (`BIGINT`)
  - `email`: User email address
  - `iss`: `'sweety-api'` (strict verification)
  - `aud`: `'sweety-client'` (strict verification)
  - `exp`: Expiration timestamp
- **Verification Parameters:**
  - Algorithm: Strictly `['HS256']` (prevents algorithm-confusion attacks like `none` or RSA/HMAC mismatch).
  - Issuer & Audience verification enabled.

### 2.3 Cryptographically Secure Opaque Refresh Tokens
- **Generation:** 256-bit cryptographically secure pseudorandom token (`crypto.randomBytes(32).toString('hex')`).
- **Database Storage:** Plaintext tokens are **never** stored. Only the SHA-256 hash (`crypto.createHash('sha256').update(token).digest('hex')`) is saved in the `refresh_tokens` table.
- **Storage in Browser:** Stored in an `httpOnly`, `SameSite=Lax`, `Secure` cookie named `refreshToken`, scoped to `/api/auth`.
- **Lifespan:** 7 days (`7d`).

### 2.4 Refresh Token Rotation & Reuse Detection
```
Client                      Server / Auth Controller                    PostgreSQL
  │                                     │                                    │
  │── POST /api/auth/refresh ──────────>│                                    │
  │   (refreshToken cookie)             │── SHA-256(token) ─────────────────>│
  │                                     │                                    │
  │                                     │<── Query token record ─────────────│
  │                                     │                                    │
  │                                     ├── IF token.revoked_at IS NOT NULL: │
  │                                     │   ⚠️ REUSE DETECTED!               │
  │                                     │   ── Invalidate ALL user tokens ──>│
  │                                     │   ── Clear all auth cookies ──────>│
  │<── 401 Unauthorized ────────────────┤                                    │
  │                                     │                                    │
  │                                     ├── IF valid and active:             │
  │                                     │   ── Mark current token revoked ──>│
  │                                     │   ── Generate new token pair ─────>│
  │                                     │   ── Save new token_hash ─────────>│
  │<── 200 OK (Set-Cookie: new tokens) ─┤                                    │
```
- **Rotation:** Every refresh operation revokes the presented refresh token and issues a new pair (`accessToken` + `refreshToken`).
- **Atomic Rotation & Concurrency Defense:** Token revocation is performed via `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, replaced_by_token_hash = $1 WHERE id = $2 AND revoked_at IS NULL RETURNING id;`. If concurrent requests arrive with the same token, PostgreSQL row-level locks serialize the operations; exactly one update succeeds (`rowCount === 1`), while the concurrent request receives `rowCount === 0`, immediately detecting reuse and revoking all active sessions for that user.
- **Reuse Detection:** If an attacker and a victim both attempt to use a previously exchanged refresh token, or if a race condition is attempted, the server detects that `revoked_at IS NOT NULL` (or `rowCount === 0`). The server immediately triggers emergency session revocation: **all active refresh tokens for that user are revoked**, terminating all active sessions.

### 2.5 Session Termination & RFC 6265bis Compliance
- **Single Logout (`POST /api/auth/logout`):**
  - Marks the active refresh token as revoked in the database.
  - Clears `accessToken`, `refreshToken`, and `csrfToken` cookies.
- **Logout All Devices (`POST /api/auth/logout-all`):**
  - Revokes all active refresh tokens for `req.user.userId`.
  - Clears cookies on the current client.
- **RFC 6265bis Cookie Clearing:** Cookies issued with the `Secure` attribute in production MUST be cleared with an identical `Secure` attribute. `clearCookie` helper options strictly match the `path`, `secure`, and `sameSite` parameters used at issuance, ensuring browsers do not reject cookie deletion.

---

## 3. Cross-Site Request Forgery (CSRF) Protection

Sweety employs the **Double Submit Cookie pattern** combined with custom header validation:
1. When a client connects or authenticates, a cryptographically secure CSRF token is issued in an accessible cookie `csrfToken` (and/or via `GET /api/auth/csrf`).
2. Any state-changing HTTP request (`POST`, `PUT`, `PATCH`, `DELETE`) must supply this token in the `X-CSRF-Token` header.
3. The CSRF middleware verifies that the header value matches the cookie value.
4. Because malicious third-party origins cannot read cookies from our origin under the Same-Origin Policy, an attacker cannot forge the matching header.

---

## 4. Cross-Origin Resource Sharing (CORS)

- **Allowed Origins:** Strictly limited to the frontend origin (e.g. `http://localhost:5173` in development; configured via `CLIENT_URL`).
- **Credentials:** `credentials: true` enabled to allow cookie transmission.
- **No Wildcards:** `origin: "*"` is strictly prohibited with credentialed requests.

---

## 5. Rate Limiting & DoS Hardening

- **Reverse Proxy Trust:** `trust proxy` enabled for Docker and production environments so rate limiting tracks actual client IPs rather than container gateway IPs.
- **Login Endpoint (`POST /api/auth/login`):** Maximum 5 failed requests per 15-minute window per IP.
- **Registration Endpoint (`POST /api/auth/register`):** Maximum 10 requests per 1-hour window per IP.
- **Body Limit:** JSON body parser strictly capped at `10kb` (`express.json({ limit: '10kb' })`) to prevent heap exhaustion.
- **Client Cookie Invalidation:** Clear authentication cookies immediately upon detecting expired or invalid refresh tokens to prevent infinite 401 retry loops.

---

## 6. Error Sanitization & Leakage Prevention

- All unexpected runtime exceptions are caught by `errorHandler.js`.
- In production (`NODE_ENV === 'production'`), error responses return a generic message:
  ```json
  { "error": "Internal server error" }
  ```
- No database table names, constraint names, query strings, or stack traces are ever exposed in HTTP responses.

---

## 7. Security Hardening Checklist (Run After Every Stage)

- [ ] All database queries use parameterized SQL (`$1, $2, ...`).
- [ ] No tokens returned in JSON response bodies.
- [ ] Access & refresh tokens stored solely in `httpOnly` cookies.
- [ ] Refresh token rotation and reuse detection verified with automated tests.
- [ ] Passwords hashed with Argon2id; plaintext never logged.
- [ ] CSRF validation active on state-changing endpoints.
- [ ] CORS allowlist verified; credentials allowed only for trusted origin.
- [ ] Error messages do not leak internal system details.
- [ ] Zod boundary validation covers all inputs.

---

## 8. Phase 2 Security Hardening: Clinical Readings & Multi-Tenancy

### 8.1 Multi-Tenant IDOR Mitigation
- All reading operations (`GET /:id`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`) verify ownership via `WHERE id = $1 AND user_id = $2`.
- When an ID is requested that does not belong to the authenticated user, the server returns `404 Not Found` (never `403 Forbidden`). This prevents malicious users from enumerating reading IDs or determining whether an ID exists.
- In `GET /api/readings` listing queries, results are scoped strictly to `WHERE user_id = $1`, guaranteeing zero cross-tenant reading leakage.

### 8.2 Concurrency & Race Condition Defense
- While application-level validation checks `COUNT(*) >= 4` and existing slot queries, concurrent requests sent in parallel could theoretically race past application checks.
- A hard PostgreSQL unique constraint `CONSTRAINT uq_user_date_slot UNIQUE (user_id, date, slot)` guarantees that no two readings for the same slot on the same date can ever be inserted.
- The controller traps PostgreSQL error code `23505` (`unique_violation`) and transforms it into HTTP `409 Conflict: "You already have an {Slot Name} reading for this date."`, maintaining seamless error parity under heavy concurrency.

### 8.3 Clinical Boundary Validation
- All inputs pass through Zod schemas before reaching the database:
  - Glucose value: Integer check, 40 mg/dL ≤ value ≤ 600 mg/dL. Whitespace-only values cleanly return `"Please enter a glucose value."`.
  - Meal slots: Enumeration strictly restricted to clinical values (`morning_fasting`, `after_breakfast`, `after_lunch`, `after_dinner`).
  - Date boundary: Evaluated against Indian Standard Time (`Asia/Kolkata`) to prevent future-dated entries. Query date strings validated against calendar leap year rules (`isValidDateString`).

### 8.4 Numerical Parameter Validation & SQL Execution Hardening
- Route parameters (`/api/readings/:id`) are strictly validated via `isValidId(id)` prior to SQL execution, verifying that `:id` is a positive integer string within PostgreSQL signed 64-bit `BIGINT` range (`1 ≤ id ≤ 9223372036854775807`).
- Non-numeric strings, negative IDs, zero, and out-of-range integers immediately return `404 Not Found`, eliminating database syntax errors (`22P02`), range errors (`22003`), and unhandled 500 exceptions.
- `errorHandler.js` defensively captures `22P02`, `22008`, and `22003` error codes, mapping them to HTTP 400 to prevent internal database queries or stack traces from ever leaking.

### 8.5 Reports & Analytics Multi-Tenant Boundary & Arithmetic Safety (Phase 3)
- Aggregation queries in `GET /api/reports` are strictly scoped by `WHERE user_id = $1 AND date >= $2 AND date <= $3` using parameterized values. Neither metrics (`COUNT`, `MAX`, `MIN`, `AVG`) nor detailed circadian slot records leak cross-tenant patient records.
- Input validation via `queryReportSchema` strictly checks `type` against permitted enums (`daily`, `month_to_date`, `monthly`) and validates `date` against genuine calendar dates using `isValidDateString` to prevent SQL datetime overflow (`22008`).
- Express prototype getters on `req.query` are shadowed safely via `Object.defineProperty`, ensuring schema defaults (e.g. today in IST) bind cleanly without runtime exceptions.
- Zero-reading timeframes safely return `count: 0, highest: null, lowest: null, average: null, readings: []`, preventing division-by-zero crashes or `NaN` metric serialization.

---

## 9. Modular Phase 1 Security Deep Dives

For exhaustive cryptographic analysis, attack surface breakdowns, code walkthroughs, and interview Q&As, refer to the following documentation files:
- [working/README.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/README.md) – Phase 1 Master Security & Architecture Overview
- [working/phase1_auth.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_auth.md) – Authentication Lifecycle, Timing Attacks & Argon2id Hashing
- [working/phase1_tokens_and_rotation.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_tokens_and_rotation.md) – Dual-Token Architecture, Atomic Rotation & Reuse Compromise Detection
- [working/phase1_csrf_and_cookies.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_csrf_and_cookies.md) – Cookie Configuration, RFC 6265bis & Double Submit CSRF Defense
- [working/phase1_rate_limit.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_rate_limit.md) – Brute-Force Rate Limiting & Proxy IP Spoofing Defense
- [working/phase1_security_libraries.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_security_libraries.md) – Core Security Libraries & HTTP Hardening (`helmet`, `cors`, `zod`, etc.)
- [working/phase1_database_and_models.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_database_and_models.md) – Database Security, Identity Columns & Multi-Tenant Isolation
- [working/phase1_error_handling_and_validation.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_error_handling_and_validation.md) – Boundary Validation & Information Disclosure Prevention
- [working/phase1_interview_qa.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_interview_qa.md) – Master Senior Backend & Security Interview Preparation

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
| **Insecure Direct Object Reference (IDOR)** | User viewing or editing another patient's readings | Hard multi-tenant isolation enforced in database queries (`WHERE user_id = $1`) on all read/write operations |
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

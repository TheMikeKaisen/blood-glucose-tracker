# 🏛️ Sweety – System Architecture Specification

This document details the software architecture, component boundaries, data flow, and structural patterns for the **Sweety – Blood Glucose Tracker** application.

---

## 1. High-Level Architecture

Sweety is engineered as a decoupled modern full-stack application following a layered Model-View-Controller (MVC) architecture on the backend, communicating with a single-page React client over a hardened REST API, backed by a relational PostgreSQL database.

```
┌────────────────────────────────────────────────────────┐
│                   React Client (Vite)                  │
│       (AuthContext, ReadingsPage, ReportsPage)         │
└───────────────────────────┬────────────────────────────┘
                            │
               HTTPS / Cookies (httpOnly)
             + CSRF Header (X-CSRF-Token)
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Express REST API                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Middlewares: Helmet, CORS, CookieParser, CSRF,   │  │
│  │ RateLimiter, BodyLimit, Zod Validator, Auth      │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │ Controllers: authController, readingsController, │  │
│  │              reportsController                   │  │
│  │ (Argon2id hashing, Token rotation, Analytics)    │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │ Database Layer: pg.Pool connection singleton     │  │
│  │ Parameterized SQL queries ($1, $2, ...)          │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │
                    TCP (Connection Pool)
                              │
┌─────────────────────────────▼──────────────────────────┐
│                   PostgreSQL Database                  │
│     (Docker Container locally / Supabase in Cloud)     │
│       - users (BIGINT IDENTITY, UNIQUE email)          │
│       - refresh_tokens (token_hash, rotation, reuse)   │
│       - readings (user_id, date, slot, value, UNIQUE)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Server Scaffolding & Separation of Concerns

### 2.1 Separation of `app.js` and `server.js`
To ensure lightning-fast, port-free automated testing:
- **`src/app.js`**: Instantiates and configures Express, mounts middlewares, attaches routes, and attaches the global error handler. It does **not** bind to a network port (`listen()`). This allows Supertest to execute in-memory HTTP integration tests in parallel without port collision.
- **`src/server.js`**: The runtime process entry point. It imports `app`, checks database connectivity, and starts listening on `PORT` (default 5000).

### 2.2 Directory Structure
```
server/
├── src/
│   ├── config/
│   │   ├── db.js                 # pg.Pool singleton and database query interface
│   │   └── env.js                # Environment variable validation and defaults
│   ├── controllers/
│   │   ├── authController.js     # Auth actions: register, login, refresh, logout, me
│   │   ├── readingsController.js # Readings CRUD: add, get daily/paginated, edit, delete
│   │   └── reportsController.js  # Glycemic reports: daily, month-to-date, monthly
│   ├── db/
│   │   ├── migrate.js            # Migration execution runner
│   │   ├── schema.sql            # Canonical PostgreSQL schema DDL (users, tokens, readings)
│   │   └── seed.js               # 30-day realistic clinical dataset seeder
│   ├── middleware/
│   │   ├── auth.js               # JWT verification & req.user attachment
│   │   ├── csrf.js               # Double-submit cookie CSRF protection
│   │   ├── errorHandler.js       # Production-hardened error response middleware
│   │   ├── rateLimiter.js        # Endpoint-specific rate limiting
│   │   └── validate.js           # Zod boundary validator with prototype getter shadowing
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth endpoints mapping
│   │   ├── readingsRoutes.js     # /api/readings endpoints mapping
│   │   └── reportsRoutes.js      # /api/reports endpoints mapping
│   ├── utils/
│   │   ├── date.js               # Indian Standard Time (Asia/Kolkata) date helpers & range math
│   │   └── security.js           # Argon2id hashing, JWT signing/verifying, crypto tokens
│   ├── validators/
│   │   ├── authValidator.js      # Zod schemas for register and login
│   │   ├── readingValidator.js   # Zod schemas for readings CRUD & query
│   │   └── reportValidator.js    # Zod schema for reports query parameters
│   ├── app.js                    # Express app setup and middleware configuration
│   └── server.js                 # Process bootstrapper and listener
├── tests/
│   ├── auth.test.js              # Auth API integration test suite
│   ├── db.test.js                # Database configuration test
│   ├── migration.test.js         # Schema migration verification test
│   ├── readingValidator.test.js  # Zod schema & date unit tests
│   ├── readings.test.js          # Readings CRUD & IDOR integration test suite
│   ├── reports.test.js           # Reports API integration & edge case test suite
│   ├── seed.test.js              # Database seeder test
│   └── security.test.js          # Crypto and security utilities test
├── .env.example
├── .gitignore
├── docker-compose.yml            # Local PostgreSQL container service
└── package.json
```

---

## 3. Layer Responsibilities

### 3.1 Routing & Validation Layer
- Routes define HTTP methods and endpoint paths.
- Every route passes requests through `validate(schema)` middleware before invoking controllers.
- Validation failures are caught immediately at the HTTP boundary, returning RFC 7807 / standard error formats without reaching business logic.

### 3.2 Controller Layer
- Implements core business rules (e.g., duplicate checks, credential verification, token rotation).
- Does not construct dynamic SQL strings.
- Interacts with the database exclusively through parameterized queries.

### 3.3 Database Layer
- Managed by `pg.Pool` with pooling parameters configured for connection stability.
- Schemas use standard PostgreSQL data types and constraints to enforce data integrity at the lowest layer.

### 3.4 Reports & Analytics Layer (Phase 3)
- Calculates time-boundary ranges (Daily, Month-to-Date, Monthly) via deterministic UTC calendar arithmetic.
- Performs aggregate calculations directly in SQL (`COUNT(*)`, `MAX(value)`, `MIN(value)`, `AVG(value)`) scoped by multi-tenant user ID (`WHERE user_id = $1 AND date >= $2 AND date <= $3`).
- Handles 0-reading datasets without division-by-zero crashes, returning null metrics and an empty list.
- Formats daily readings in strict circadian meal slot order (`morning_fasting` → `after_breakfast` → `after_lunch` → `after_dinner`).

---

## 4. Multi-Tenant Isolation & IDOR Protection

Multi-tenancy in Sweety is row-level:
- All patient glucose readings reference `users(id)` via `user_id BIGINT NOT NULL`.
- Every SQL query performing reads, updates, or deletes incorporates `WHERE user_id = $1`.
- IDOR vulnerabilities are prevented because reading IDs are never accessed without matching the requesting user's identity extracted from the verified JWT cookie.

---

## 5. Portability Strategy (Docker to Supabase)

- Primary keys use `BIGINT GENERATED BY DEFAULT AS IDENTITY`, conforming to modern SQL standards and matching Supabase default schema conventions.
- Timestamps use `TIMESTAMPTZ` with `DEFAULT CURRENT_TIMESTAMP`.
- The application relies solely on standard PostgreSQL features. Switching from local Docker PostgreSQL to cloud Supabase requires changing only the `DATABASE_URL` environment variable.

---

## 7. Frontend Client Architecture (Phase 4: React & Hallmark UI)

### 7.1 Tech Stack & Bundler Design
- **Framework:** React 19 + TypeScript.
- **Bundler:** Vite 8 (Rolldown engine) with manual chunk splitting (`vendor-react`, `vendor-charts`, `vendor-icons`), minimizing main bundle to ~57 kB.
- **Styling & Design System:** Tailwind CSS v4, Hallmark Floor Token Architecture in `:root`.
- **Icons:** `lucide-react`.
- **Charting:** `recharts` for glycemic trend line curves with ADA target reference lines.
- **Testing:** Vitest + React Testing Library + `@testing-library/jest-dom`.

### 7.2 Single-Flight Refresh Mutex Architecture
```
Multiple API Calls (401 Expired Access Token)
         │           │           │
         ▼           ▼           ▼
   ┌───────────────────────────────────┐
   │ Single-Flight Refresh Mutex       │
   │ (ApiService.executeRefreshMutex)  │
   └─────────────────┬─────────────────┘
                     │ (Exactly 1 network request)
                     ▼
           POST /api/auth/refresh
           (with X-CSRF-Token)
                     │
                     ▼
   ┌───────────────────────────────────┐
   │ Server Rotates Access & Refresh   │
   │ Cookies + Issues New CSRF Token   │
   └─────────────────┬─────────────────┘
                     │
                     ▼
   All Queued Requests Resume & Retry
   (Prevents false breach triggers)
```

### 7.3 Component Hierarchy & Layout
```
App
├── AuthProvider (session state, user, login, register, demo login, logout)
└── Authenticated Layout
    ├── Header (Brand badge, patient identity, ADA target info trigger, sign out)
    ├── Shell (Max-w-2xl centered responsive container)
    │   ├── ReadingsPage (DateBar, DailyProgress circadian steps, ReadingSlotCards, Modals)
    │   ├── ReportsPage (ReportTypeSelector, SummaryCards, TrendChart, EmptyState)
    │   └── TargetsPage (Clinical ADA guidelines, profile actions, revoke-all-devices)
    ├── BottomNav (Mobile-native thumb navigation: Readings | Reports | Targets)
    └── ClinicalTargetsModal (ADA target guidelines quick reference)
```

---

## 8. Deep Technical Implementation Guides

For in-depth code walkthroughs, cryptographic threat models, library breakdowns, and senior engineering interview preparation, refer to the modular documentation directory:
- [working/README.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/README.md) – Phase 1 Master Architecture Guide & Document Index.
- [working/phase1_auth.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_auth.md) – Authentication Lifecycle & Argon2id Engine.
- [working/phase1_tokens_and_rotation.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_tokens_and_rotation.md) – Dual-Token Architecture, Atomic Rotation & Reuse Detection.
- [working/phase1_csrf_and_cookies.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_csrf_and_cookies.md) – Cookie Configuration & Double Submit CSRF Defense.
- [working/phase1_rate_limit.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_rate_limit.md) – Rate Limiting & Proxy Trust Configurations.
- [working/phase1_security_libraries.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_security_libraries.md) – Core Security Libraries & HTTP Hardening.
- [working/phase1_database_and_models.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_database_and_models.md) – Database Architecture & Multi-Tenant Design.
- [working/phase1_error_handling_and_validation.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_error_handling_and_validation.md) – Validation & Centralized Error Handling.
- [working/phase1_interview_qa.md](file:///c:/Users/computer/Downloads/blood-glucose-tracker/working/phase1_interview_qa.md) – Master Senior Backend & Security Interview Preparation.

---

## 9. Future Architectural Roadmap

### 9.1 Identity Verification & One-Time Password (OTP) Pipeline
- **OTP Verification Flow**: Introduce an asynchronous notification adapter interface (`EmailOtpService`, `SmsOtpService`) decoupled from the core auth controller. Registration will support a staged `unverified` status requiring 6-digit OTP verification before session tokens are minted.
- **Challenge Token Abstraction**: Post-OTP validation issues a single-use JWT verification ticket (`purpose: 'verify_email' | 'reset_password'`) required to finalize state mutations.

### 9.2 Background Queues (BullMQ / Redis)
- Implement background queue workers for scheduled evening reminder notifications for patients logging fewer than 4 readings, and asynchronous out-of-band OTP email/SMS delivery.

### 9.3 Clinician & Doctor Role-Based Access Control (RBAC)
- Extend multi-tenancy to support clinician accounts with read-only authorization delegates for assigned patient glucose records and reports.

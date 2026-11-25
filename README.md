# 🩺 Sweety – Blood Glucose Tracker

A web application for diabetes patients to record up to 4 blood glucose readings a day and view daily and monthly reports. Built with Node.js, Express, PostgreSQL, and React.

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Docker Desktop](https://www.docker.com/) (for running PostgreSQL)

### 2. Installation
Clone the repository and install dependencies for server and client:
```bash
npm --prefix server install
npm --prefix client install
```

### 3. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
cp .env.example server/.env
```
Default values in `.env.example` work out of the box with the local Docker PostgreSQL container:
- `PORT=5000`
- `NODE_ENV=development`
- `DATABASE_URL=postgres://sweety_user:sweety_password@localhost:5432/sweety_db`
- `JWT_SECRET=sweety_super_secret_jwt_key_at_least_32_characters_long_for_security`
- `CLIENT_URL=http://localhost:5173`

### 4. Database Setup
Start PostgreSQL via Docker:
```bash
docker compose up -d db
```
Run migrations (creates `users`, `refresh_tokens`, and `readings` tables):
```bash
npm run db:migrate
```
Seed demo user with 30 days of sample readings:
```bash
npm run db:seed
```
**Demo User Credentials:**
- **Email:** `demo@sweety.dev`
- **Password:** `Demo1234!`

### 5. Running the Application
Start backend and frontend in separate terminals:
```bash
# Terminal 1: Backend API (http://localhost:5000)
npm run server

# Terminal 2: Frontend Client (http://localhost:5173)
npm run client
```

### 6. Running Tests
```bash
# Run backend tests (142 tests)
npm test

# Run frontend tests (18 tests)
npm run test:client
```

---

## 📋 Features

### 1. Sign up and log in
- User registration with name, email, and password.
- Secure password hashing using Argon2id (OWASP recommended).
- Multi-tenant data isolation: patients only see their own readings.

### 2. Add, view, edit and delete readings
- Record glucose level (in mg/dL) for 4 daily meal slots: `Morning (fasting)`, `After breakfast`, `After lunch`, `After dinner`.
- Enforces strict validation with clear error messages:
  | Rule | Error Message |
  |---|---|
  | Value is required | `"Please enter a glucose value."` |
  | Value must be a whole number between 40 and 600 | `"Value must be between 40 and 600 mg/dl."` |
  | Only one reading per slot per day | `"You already have an {Slot Name} reading for this date."` |
  | Maximum 4 readings per day | `"You can add only 4 readings per day."` |
  | Date cannot be in the future | `"Date cannot be in the future."` |

### 3. Reports
- Highest, lowest, and average readings (rounded to 1 decimal place), along with total reading count.
- Friendly empty states when no readings exist.
  | Report | Date Range | Example (Selected Date: 15 Oct 2026) |
  |---|---|---|
  | **Daily** | The selected date (lists each reading with its slot) | `15 Oct 2026` |
  | **Month-to-date** | 1st of the month to the selected date | `1 Oct – 15 Oct 2026` |
  | **Monthly** | The whole previous month | `1 Sep – 30 Sep 2026` |

### Bonus Features Implemented
- **Charts:** Interactive line chart plotting monthly readings with clinical reference bands (Recharts).
- **Pagination:** `GET /api/readings?page=1&limit=20` with page, limit, total, and totalPages metadata.
- **Docker Compose:** Dockerized PostgreSQL setup with healthchecks.
- **Frontend Tests:** React Testing Library integration tests for the reading form.

---

## 📝 Notes

### Assumptions
- **Date & Timezone Integrity:** Storing dates as standard UTC timestamps causes shifts across midnight. All readings are stored as calendar `DATE` strings (`YYYY-MM-DD`) without UTC offset distortion.
- **Daily Limits & Slots:** A patient can record at most 4 readings per day, each mapped to one of the four clinical meal slots.
- **Password & Session Security:** Passwords use memory-hard Argon2id. Tokens are stored in httpOnly, SameSite cookies to protect against XSS token exfiltration.
- **Data Isolation:** Every reading and report query enforces `WHERE user_id = $userId` at the database level to prevent IDOR vulnerabilities.
- **Statistical Rounding:** Report averages are rounded using standard 1-decimal arithmetic rounding (`Math.round(val * 10) / 10`).

### What I'd Improve with More Time
- **Doctor Role:** Clinician accounts to view assigned patients' daily/monthly reports and glycemic curves.
- **OTP Verification:** Email or SMS one-time password (OTP) verification for user registration and password resets to verify patient identity.
- **Redis Report Caching:** Cache daily and monthly report aggregates in Redis, invalidated whenever a reading is added, edited, or deleted.
- **BullMQ Background Jobs:** Daily reminder queues to alert users who have logged fewer than 4 readings.
- **CSV & PDF Export:** One-click download of clinical reports for patient-doctor visits.
- **Custom Target Ranges:** Configurable glycemic targets for personalized diabetic care.

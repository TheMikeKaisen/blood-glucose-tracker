# 📡 Sweety – REST API Specification (Phase 1: Auth & Session)

This document describes the HTTP REST endpoints, request payloads, response bodies, and error structures for authentication and session management in Sweety.

---

## 1. Global Conventions

### 1.1 Base URL
All API endpoints are mounted under `/api`.

### 1.2 Authentication & Cookies
Authentication uses cookies rather than returning tokens in JSON response bodies:
- **`accessToken`**: Short-lived JWT (10 min). Set with `HttpOnly; Path=/; SameSite=Lax; Secure` (in production).
- **`refreshToken`**: Opaque token (7 days). Set with `HttpOnly; Path=/api/auth; SameSite=Lax; Secure` (in production).
- **`csrfToken`**: CSRF protection token. Set with `Path=/; SameSite=Lax; Secure` (in production; accessible to client JS).

### 1.3 CSRF Protection
Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require an `X-CSRF-Token` header whose value matches the `csrfToken` cookie.

### 1.4 Standard Error Response Model
```json
{
  "error": "Human-readable description of error"
}
```

---

## 2. Authentication Endpoints

### 2.1 Register
- **Method / Path:** `POST /api/auth/register`
- **Rate Limit:** 10 requests / hour per IP
- **Headers:** `Content-Type: application/json`, `X-CSRF-Token: <token>`
- **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123!"
  }
  ```
- **Validation Rules:**
  - `name`: string, min 2 chars, max 100 chars
  - `email`: valid email string, normalized (trimmed, lowercase)
  - `password`: string, min 8 chars, max 128 chars
- **Success Response (`201 Created`):**
  - **Set-Cookie:** `accessToken=...`, `refreshToken=...`, `csrfToken=...`
  - **Response Body:**
    ```json
    {
      "user": {
        "id": "1",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "csrfToken": "abc123csrf..."
    }
    ```
- **Error Responses:**
  - `409 Conflict`: `{"error": "Email already registered"}`
  - `422 Unprocessable Entity`: `{"error": "Validation error message"}`

---

### 2.2 Login
- **Method / Path:** `POST /api/auth/login`
- **Rate Limit:** 5 requests / 15 minutes per IP
- **Headers:** `Content-Type: application/json`, `X-CSRF-Token: <token>`
- **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (`200 OK`):**
  - **Set-Cookie:** `accessToken=...`, `refreshToken=...`, `csrfToken=...`
  - **Response Body:**
    ```json
    {
      "user": {
        "id": "1",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "csrfToken": "abc123csrf..."
    }
    ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Invalid email or password"}`
  - `422 Unprocessable Entity`: `{"error": "Validation error message"}`
  - `429 Too Many Requests`: `{"error": "Too many login attempts, please try again later"}`

---

### 2.3 Refresh Token
- **Method / Path:** `POST /api/auth/refresh`
- **Headers:** `X-CSRF-Token: <token>`
- **Cookies Required:** `refreshToken`
- **Success Response (`200 OK`):**
  - **Set-Cookie:** Rotated `accessToken=...`, rotated `refreshToken=...`
  - **Response Body:**
    ```json
    {
      "message": "Token refreshed successfully"
    }
    ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Invalid or expired refresh token"}`
  - Token reuse detection triggers total user session invalidation and returns `401`.

---

### 2.4 Logout
- **Method / Path:** `POST /api/auth/logout`
- **Headers:** `X-CSRF-Token: <token>`
- **Cookies Required:** `refreshToken`
- **Success Response (`200 OK`):**
  - **Set-Cookie:** Clears `accessToken`, `refreshToken`, `csrfToken`
  - **Response Body:**
    ```json
    {
      "message": "Logged out successfully"
    }
    ```

---

### 2.5 Logout All Devices
- **Method / Path:** `POST /api/auth/logout-all`
- **Headers:** `X-CSRF-Token: <token>`
- **Cookies Required:** `accessToken`
- **Success Response (`200 OK`):**
  - **Set-Cookie:** Clears `accessToken`, `refreshToken`, `csrfToken`
  - **Response Body:**
    ```json
    {
      "message": "Logged out from all devices"
    }
    ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Authentication required"}`

---

### 2.6 Get Profile / Session (Me)
- **Method / Path:** `GET /api/auth/me` or `GET /api/auth/session`
- **Cookies Required:** `accessToken` (or `Authorization: Bearer <token>`)
- **Success Response (`200 OK`):**
  ```json
  {
    "user": {
      "id": "1",
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Authentication required"}` (or `{"error": "Invalid or expired token"}`)

---

### 2.7 Get CSRF Token
- **Method / Path:** `GET /api/auth/csrf`
- **Success Response (`200 OK`):**
  - **Set-Cookie:** `csrfToken=...`
  - **Response Body:**
    ```json
    {
      "csrfToken": "abc123csrf..."
    }
    ```

---

## 3. Readings Endpoints (Phase 2)

All `/api/readings` endpoints require authentication via `accessToken` cookie.
Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require the `X-CSRF-Token` header.

### 3.1 Create Reading
- **Method / Path:** `POST /api/readings`
- **Headers:** `Content-Type: application/json`, `X-CSRF-Token: <token>`
- **Cookies Required:** `accessToken`, `csrfToken`
- **Request Body:**
  ```json
  {
    "date": "2026-10-15",
    "slot": "morning_fasting",
    "value": 110
  }
  ```
- **Validation Rules:**
  - `date`: required, valid ISO string `YYYY-MM-DD`, cannot be in the future relative to Indian Standard Time (`Asia/Kolkata`).
  - `slot`: required ENUM (`morning_fasting`, `after_breakfast`, `after_lunch`, `after_dinner`).
  - `value`: required integer, between 40 and 600 mg/dL inclusive.
- **Success Response (`201 Created`):**
  ```json
  {
    "reading": {
      "id": "1",
      "userId": "1",
      "date": "2026-10-15",
      "slot": "morning_fasting",
      "value": 110,
      "createdAt": "2026-10-15T02:30:00.000Z",
      "updatedAt": "2026-10-15T02:30:00.000Z"
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Authentication required"}`
  - `409 Conflict`:
    - Duplicate slot: `{"error": "You already have an {Slot Name} reading for this date."}`
    - Daily count exceeded: `{"error": "You can add only 4 readings per day."}`
  - `422 Unprocessable Entity`:
    - Missing value: `{"error": "Please enter a glucose value."}`
    - Out of range / non-integer: `{"error": "Value must be between 40 and 600 mg/dl."}`
    - Future date: `{"error": "Date cannot be in the future."}`
    - Invalid slot: `{"error": "Invalid time slot selected."}`

---

### 3.2 List Readings (Daily or Paginated)
- **Method / Path:** `GET /api/readings`
- **Cookies Required:** `accessToken`
- **Query Parameters:**
  - `date`: optional `YYYY-MM-DD` calendar date string. Must be a valid calendar date (e.g. `2026-02-31` is rejected with 422). If specified, returns all readings for that date sorted chronologically by meal slot (`morning_fasting` → `after_breakfast` → `after_lunch` → `after_dinner`). Empty string falls back to pagination.
  - `page`: optional integer (default: `1`, min: `1`).
  - `limit`: optional integer (default: `20`, min: `1`, max: `100`).
- **Success Response (Date Filtered - `200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "1",
        "userId": "1",
        "date": "2026-10-15",
        "slot": "morning_fasting",
        "value": 90,
        "createdAt": "2026-10-15T02:30:00.000Z",
        "updatedAt": "2026-10-15T02:30:00.000Z"
      }
    ]
  }
  ```
- **Success Response (Paginated - `200 OK`):**
  ```json
  {
    "data": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
  ```

---

### 3.3 Get Reading by ID
- **Method / Path:** `GET /api/readings/:id`
- **Cookies Required:** `accessToken`
- **Success Response (`200 OK`):**
  ```json
  {
    "reading": {
      "id": "1",
      "userId": "1",
      "date": "2026-10-15",
      "slot": "morning_fasting",
      "value": 90,
      "createdAt": "2026-10-15T02:30:00.000Z",
      "updatedAt": "2026-10-15T02:30:00.000Z"
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Authentication required"}`
  - `404 Not Found`: `{"error": "Reading not found"}` (returned if reading does not exist, ID is non-numeric/out-of-range, OR belongs to another patient)

---

### 3.4 Full Update Reading (PUT)
- **Method / Path:** `PUT /api/readings/:id`
- **Headers:** `Content-Type: application/json`, `X-CSRF-Token: <token>`
- **Cookies Required:** `accessToken`, `csrfToken`
- **Request Body:** All fields required (`date`, `slot`, `value`).
- **Success Response (`200 OK`):**
  ```json
  {
    "reading": {
      "id": "1",
      "userId": "1",
      "date": "2026-10-15",
      "slot": "after_breakfast",
      "value": 130,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```
- **Error Responses:**
  - `404 Not Found`: `{"error": "Reading not found"}`
  - `409 Conflict`: Duplicate slot or daily limit exceeded on target date
  - `422 Unprocessable Entity`: Validation failure

---

### 3.5 Partial Update Reading (PATCH)
- **Method / Path:** `PATCH /api/readings/:id`
- **Headers:** `Content-Type: application/json`, `X-CSRF-Token: <token>`
- **Cookies Required:** `accessToken`, `csrfToken`
- **Request Body:** At least one field required (`value`, `slot`, or `date`).
- **Success Response (`200 OK`):**
  ```json
  {
    "reading": {
      "id": "1",
      "userId": "1",
      "date": "2026-10-15",
      "slot": "morning_fasting",
      "value": 95,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```
- **Error Responses:**
  - `404 Not Found`: `{"error": "Reading not found"}`
  - `422 Unprocessable Entity`: Empty body `{"error": "At least one field must be provided for update."}` or invalid field values

---

### 3.6 Delete Reading
- **Method / Path:** `DELETE /api/readings/:id`
- **Headers:** `X-CSRF-Token: <token>`
- **Cookies Required:** `accessToken`, `csrfToken`
- **Success Response (`200 OK`):**
  ```json
  {
    "message": "Reading deleted successfully"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: `{"error": "Authentication required"}`
  - `404 Not Found`: `{"error": "Reading not found"}`

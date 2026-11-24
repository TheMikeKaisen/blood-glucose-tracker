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

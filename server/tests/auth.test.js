const request = require('supertest');
const app = require('../src/app');
const { pool, query, resetTestDb } = require('../src/config/db');

describe('Auth API Integration Tests (Phase 1)', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });

  describe('Healthcheck Endpoint', () => {
    it('GET /health returns 200 and ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/register', () => {
    it('successfully registers a user with valid data and sets httpOnly cookies', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Sharma',
          email: 'priya@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe('Priya Sharma');
      expect(res.body.user.email).toBe('priya@example.com');
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.csrfToken).toBeDefined();

      // Verify cookies set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('csrfToken='))).toBe(true);
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Original User',
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });

    it('rejects duplicate email case-insensitively with 409 Conflict', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Original User',
          email: 'patient@sweety.dev',
          password: 'Password123!',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Case User',
          email: 'PATIENT@sweety.dev',
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });

    it('rejects password shorter than 8 characters with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password User',
          email: 'short@example.com',
          password: 'short',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    it('rejects name shorter than 2 characters with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: 'valid@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Name must be at least 2 characters');
    });

    it('rejects malformed email format with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Valid Name',
          email: 'invalid-email-string',
          password: 'Password123!',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Please provide a valid email address');
    });

    it('rejects name longer than 100 characters with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'N'.repeat(101),
          email: 'longname@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Name cannot exceed 100 characters');
    });

    it('rejects password longer than 128 characters with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Valid Name',
          email: 'longpassword@example.com',
          password: 'P'.repeat(129),
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Password cannot exceed 128 characters');
    });

    it('sets correct security flags on cookies (HttpOnly, SameSite, Path scoping)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Cookie Flags User',
          email: 'cookieflags@example.com',
          password: 'Password123!',
        });

      const cookies = res.headers['set-cookie'];
      const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      const csrfCookie = cookies.find((c) => c.startsWith('csrfToken='));

      expect(accessCookie).toContain('Path=/');
      expect(accessCookie.toLowerCase()).toContain('httponly');
      expect(accessCookie.toLowerCase()).toContain('samesite=lax');

      // Refresh cookie MUST be scoped to /api/auth
      expect(refreshCookie).toContain('Path=/api/auth');
      expect(refreshCookie.toLowerCase()).toContain('httponly');
      expect(refreshCookie.toLowerCase()).toContain('samesite=lax');

      // CSRF cookie must be accessible to JS client (NOT httpOnly)
      expect(csrfCookie).toContain('Path=/');
      expect(csrfCookie.toLowerCase()).not.toContain('httponly');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login Test User',
          email: 'login@example.com',
          password: 'Password123!',
        });
    });

    it('successfully logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.csrfToken).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('normalizes email with whitespace and uppercase on login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: '  LOGIN@EXAMPLE.COM  ',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('login@example.com');
    });

    it('rejects incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('rejects non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    let authCookies;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Profile User',
          email: 'profile@example.com',
          password: 'Password123!',
        });
      authCookies = reg.headers['set-cookie'];
    });

    it('returns user profile when authenticated with accessToken cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('profile@example.com');
      expect(res.body.user.name).toBe('Profile User');
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('returns 401 when invalid token cookie is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['accessToken=invalid.token.here']);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('GET /api/auth/session returns user profile identically to /me', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', authCookies);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('profile@example.com');
      expect(res.body.user.name).toBe('Profile User');
    });
  });

  describe('POST /api/auth/refresh (Rotation & Reuse Detection)', () => {
    it('successfully rotates refresh token and issues new access token', async () => {
      // 1. Register to get initial cookies
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Refresh Test User',
          email: 'refresh@example.com',
          password: 'Password123!',
        });

      const initialCookies = regRes.headers['set-cookie'];
      const csrfToken = regRes.body.csrfToken;

      // 2. Perform refresh
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.message).toBe('Token refreshed successfully');

      const rotatedCookies = refreshRes.headers['set-cookie'];
      expect(rotatedCookies).toBeDefined();
      expect(rotatedCookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(rotatedCookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

      // 3. Attempt to REUSE the old refresh token (Compromise detection)
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookies) // Old refresh token
        .set('X-CSRF-Token', csrfToken);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error).toContain('Compromised token detected');

      // 4. Verify that the rotated token was also revoked because of breach detection
      const rotatedCsrf = refreshRes.body.csrfToken || csrfToken;
      const subsequentRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', rotatedCookies)
        .set('X-CSRF-Token', rotatedCsrf);

      expect(subsequentRes.status).toBe(401);
    });

    it('rejects refresh when no refresh token cookie is sent', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
    });

    it('handles concurrent refresh attempts atomically, detecting reuse and denying duplicate rotation', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Concurrent User',
          email: 'concurrent@example.com',
          password: 'Password123!',
        });

      const initialCookies = regRes.headers['set-cookie'];
      const csrfToken = regRes.body.csrfToken;

      // Two concurrent refresh requests with the exact same refresh token
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/auth/refresh')
          .set('Cookie', initialCookies)
          .set('X-CSRF-Token', csrfToken),
        request(app)
          .post('/api/auth/refresh')
          .set('Cookie', initialCookies)
          .set('X-CSRF-Token', csrfToken),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (200) and the other must be rejected (401 compromise detected)
      expect(statuses).toEqual([200, 401]);
      const rejectedRes = res1.status === 401 ? res1 : res2;
      expect(rejectedRes.body.error).toContain('Compromised token detected');
    });

    it('clears auth cookies when refresh token is expired', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Expired Test User',
          email: 'expired_user@example.com',
          password: 'Password123!',
        });

      const initialCookies = regRes.headers['set-cookie'];
      const csrfToken = regRes.body.csrfToken;

      // Set expires_at in the past
      await query(
        `UPDATE refresh_tokens 
         SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
         WHERE user_id = (SELECT id FROM users WHERE email = 'expired_user@example.com');`
      );

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', initialCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');

      // Verify cookies are cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.startsWith('accessToken=;'))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
    });
  });

  describe('POST /api/auth/logout and /api/auth/logout-all', () => {
    let authCookies;
    let csrfToken;

    beforeEach(async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'Password123!',
        });
      authCookies = reg.headers['set-cookie'];
      csrfToken = reg.body.csrfToken;
    });

    it('logout revokes refresh token and clears cookies', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', authCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');

      // Verify clearCookie paths
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const accessClear = cookies.find((c) => c.startsWith('accessToken=;'));
      const refreshClear = cookies.find((c) => c.startsWith('refreshToken=;'));
      expect(accessClear).toBeDefined();
      expect(accessClear).toContain('Path=/');
      expect(refreshClear).toBeDefined();
      expect(refreshClear).toContain('Path=/api/auth');

      // Attempting to refresh with the logged out token must now fail
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', authCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(refreshRes.status).toBe(401);
    });

    it('logout-all revokes all sessions for the user', async () => {
      const res = await request(app)
        .post('/api/auth/logout-all')
        .set('Cookie', authCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out from all devices');

      // Attempting to refresh fails
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', authCookies)
        .set('X-CSRF-Token', csrfToken);

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('CSRF Protection', () => {
    it('rejects mutating request when csrfToken cookie exists but header is missing', async () => {
      // Get CSRF cookie
      const csrfRes = await request(app).get('/api/auth/csrf');
      const csrfCookies = csrfRes.headers['set-cookie'];

      // POST to logout with cookie but without X-CSRF-Token header
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', csrfCookies);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid or missing CSRF token');
    });

    it('rejects mutating request when X-CSRF-Token header does not match cookie', async () => {
      const csrfRes = await request(app).get('/api/auth/csrf');
      const csrfCookies = csrfRes.headers['set-cookie'];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', csrfCookies)
        .set('X-CSRF-Token', 'wrong-token-value-that-does-not-match');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid or missing CSRF token');
    });

    it('rejects mutating request when X-CSRF-Token is an array or whitespace', async () => {
      const csrfRes = await request(app).get('/api/auth/csrf');
      const csrfCookies = csrfRes.headers['set-cookie'];

      const resArray = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', csrfCookies)
        .set('X-CSRF-Token', ['token1', 'token2']);

      expect(resArray.status).toBe(403);
      expect(resArray.body.error).toBe('Invalid or missing CSRF token');

      const resBlank = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', csrfCookies)
        .set('X-CSRF-Token', '   ');

      expect(resBlank.status).toBe(403);
      expect(resBlank.body.error).toBe('Invalid or missing CSRF token');
    });
  });

  describe('Payload Limits and Error Sanitization', () => {
    it('returns 400 for malformed JSON request body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ malformed json');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Malformed JSON payload');
    });

    it('returns 413 for request bodies exceeding 10kb limit', async () => {
      const largePayload = {
        name: 'Huge Body',
        email: 'huge@example.com',
        password: 'a'.repeat(12000), // > 10kb
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(largePayload);

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Payload too large. Limit is 10kb.');
    });
  });
});

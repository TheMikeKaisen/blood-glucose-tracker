const {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateCsrfToken,
} = require('../src/utils/security');

describe('Security Utilities', () => {
  it('hashes passwords using Argon2id and verifies them correctly', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);
    expect(hash).toContain('$argon2id$');

    const isValid = await verifyPassword(hash, raw);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  it('signs and verifies JWT access tokens with correct claims', () => {
    const user = { id: 42, email: 'patient@sweety.dev', name: 'Priya Sharma' };
    const token = generateAccessToken(user);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.email).toBe('patient@sweety.dev');
    expect(decoded.name).toBe('Priya Sharma');
    expect(decoded.iss).toBe('sweety-api');
    expect(decoded.aud).toBe('sweety-client');
  });

  it('rejects tampered or malformed JWT access tokens', () => {
    expect(() => verifyAccessToken('malformed.token.value')).toThrow();
  });

  it('generates 256-bit opaque refresh tokens and computes SHA-256 hashes', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();
    expect(token1).toHaveLength(64); // 32 bytes hex
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const hash1 = hashToken(token1);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hashToken(token1));
  });

  it('generates random CSRF tokens', () => {
    const csrf1 = generateCsrfToken();
    const csrf2 = generateCsrfToken();
    expect(csrf1).toHaveLength(48); // 24 bytes hex
    expect(csrf1).not.toBe(csrf2);
  });
});

describe('Error Handler Middleware', () => {
  const { errorHandler } = require('../src/middleware/errorHandler');

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  it('differentiates email unique constraint violations from other 23505 violations', () => {
    const res1 = mockRes();
    const emailErr = { code: '23505', constraint: 'idx_users_email_lower', detail: 'Key (lower(email)) already exists.' };
    errorHandler(emailErr, {}, res1, () => {});
    expect(res1.status).toHaveBeenCalledWith(409);
    expect(res1.json).toHaveBeenCalledWith({ error: 'Email already registered' });

    const res2 = mockRes();
    const readingErr = { code: '23505', constraint: 'uq_user_date_slot', detail: 'Key (user_id, date, slot) already exists.' };
    errorHandler(readingErr, {}, res2, () => {});
    expect(res2.status).toHaveBeenCalledWith(409);
    expect(res2.json).toHaveBeenCalledWith({ error: 'Duplicate or conflicting record' });
  });

  it('returns 400 for malformed JSON syntax error', () => {
    const res = mockRes();
    const err = new SyntaxError('Unexpected token');
    err.status = 400;
    err.body = '{ bad';
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Malformed JSON payload' });
  });

  it('returns 413 for payload size exceeded', () => {
    const res = mockRes();
    const err = { type: 'entity.too.large' };
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payload too large. Limit is 10kb.' });
  });
});

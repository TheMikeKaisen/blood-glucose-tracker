import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from '../services/api';

describe('ApiService – Single-Flight Refresh Mutex & CSRF Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    api.setCsrfToken(null);
  });

  it('attaches X-CSRF-Token header to state-mutating requests', async () => {
    api.setCsrfToken('test-csrf-token-123');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ reading: { id: '1', value: 100 } }),
    });
    globalThis.fetch = mockFetch;

    await api.readings.create({
      date: '2026-10-15',
      slot: 'morning_fasting',
      value: 100,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['X-CSRF-Token']).toBe('test-csrf-token-123');
    expect(options.credentials).toBe('include');
  });

  it('queues concurrent 401 requests behind a single in-flight refresh promise (Single-Flight Mutex)', async () => {
    let refreshCalls = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        // Simulate refresh endpoint response
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Token refreshed', csrfToken: 'new-rotated-csrf' }),
        };
      }

      // First time readings endpoint is called, return 401
      if (refreshCalls === 0) {
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Invalid or expired token' }),
        };
      }

      // After refresh succeeds, retry returns 200 OK
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [{ id: '1', value: 95 }] }),
      };
    });

    globalThis.fetch = mockFetch;

    // Fire 3 simultaneous API calls that get 401
    const [res1, res2, res3] = await Promise.all([
      api.readings.list({ date: '2026-10-15' }),
      api.readings.list({ date: '2026-10-15' }),
      api.readings.list({ date: '2026-10-15' }),
    ]);

    // Crucial check: Only ONE /auth/refresh call was made!
    expect(refreshCalls).toBe(1);

    // All 3 requests succeeded on retry
    expect(res1.data).toHaveLength(1);
    expect(res2.data).toHaveLength(1);
    expect(res3.data).toHaveLength(1);
  });

  it('triggers onUnauthorized callback if refresh token fails with 401', async () => {
    const onUnauthorized = vi.fn();
    api.setOnUnauthorized(onUnauthorized);

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Invalid or expired refresh token' }),
        };
      }
      return {
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Authentication required' }),
      };
    });

    globalThis.fetch = mockFetch;

    await expect(api.readings.list({ date: '2026-10-15' })).rejects.toThrow(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('stress tests Single-Flight Mutex with 10 concurrent requests under simulated network jitter', async () => {
    let refreshCalls = 0;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      // Add random jitter delay 5ms - 20ms
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15) + 5));

      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Token refreshed', csrfToken: 'rotated-csrf-10' }),
        };
      }

      // Initial requests get 401 until refresh completes
      if (refreshCalls === 0) {
        return {
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Token expired' }),
        };
      }

      // Retried requests succeed
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: [{ id: '1', value: 100 }] }),
      };
    });

    globalThis.fetch = mockFetch;

    // Launch 10 simultaneous API requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      api.readings.list({ date: `2026-10-${10 + (i % 5)}` })
    );

    const results = await Promise.all(promises);

    // Assert that exactly ONE /auth/refresh was executed
    expect(refreshCalls).toBe(1);
    expect(results).toHaveLength(10);
    results.forEach((res) => {
      expect(res.data).toHaveLength(1);
    });
  });

  it('wipes CSRF token upon calling logout or logoutAll', async () => {
    api.setCsrfToken('active-session-csrf');
    expect(api.getCsrfToken()).toBe('active-session-csrf');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Logged out successfully' }),
    });
    globalThis.fetch = mockFetch;

    await api.auth.logout();

    expect(api.getCsrfToken()).toBeNull();

    // Re-set and test logoutAll
    api.setCsrfToken('another-csrf');
    await api.auth.logoutAll();

    expect(api.getCsrfToken()).toBeNull();
  });
});

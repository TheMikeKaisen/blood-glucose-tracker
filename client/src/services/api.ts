import type { User, AuthResponse, CsrfResponse } from '../types/auth';
import type {
  ReadingsResponse,
  ReadingResponse,
  TimeSlot,
} from '../types/reading';
import type { ReportResponse, ReportType } from '../types/report';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiService {
  private baseUrl = '/api';
  private csrfToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;
  private lastRefreshTime = 0;

  constructor() {
    // Attempt to read csrfToken from document.cookie if available
    this.readCsrfFromCookie();
  }

  public setOnUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  private readCsrfFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )csrfToken=([^;]*)/);
    if (match && match[1]) {
      this.csrfToken = decodeURIComponent(match[1]);
      return this.csrfToken;
    }
    return null;
  }

  public setCsrfToken(token: string | null) {
    this.csrfToken = token;
  }

  public getCsrfToken(): string | null {
    return this.csrfToken || this.readCsrfFromCookie();
  }

  /**
   * Fetches fresh CSRF token from the server
   */
  public async fetchCsrfToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new ApiError('Failed to fetch CSRF token', res.status);
    }

    const data: CsrfResponse = await res.json();
    this.csrfToken = data.csrfToken;
    return data.csrfToken;
  }

  /**
   * Single-Flight Refresh Mutex
   * Ensures only ONE /api/auth/refresh request is in-flight at any time,
   * queuing all subsequent 401s behind it to prevent token reuse detection triggers.
   */
  private async executeRefreshMutex(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        let token = this.getCsrfToken();
        if (!token) {
          try {
            token = await this.fetchCsrfToken();
          } catch {
            // Proceed anyway, the server will check cookies
          }
        }

        const headers: Record<string, string> = {
          Accept: 'application/json',
        };
        if (token) {
          headers['X-CSRF-Token'] = token;
        }

        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers,
        });

        if (!res.ok) {
          // Token refresh failed or was reused/revoked
          this.csrfToken = null;
          if (this.onUnauthorizedCallback) {
            this.onUnauthorizedCallback();
          }
          throw new ApiError('Session expired. Please log in again.', res.status);
        }

        const data = await res.json().catch(() => ({}));
        if (data.csrfToken) {
          this.csrfToken = data.csrfToken;
        } else {
          this.readCsrfFromCookie();
        }

        this.lastRefreshTime = Date.now();
        return this.csrfToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Core request wrapper handling credentials, CSRF, and 401 refresh retry
   */
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const requestStartTime = Date.now();
    const url = `${this.baseUrl}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach CSRF token on mutating requests
    if (isMutation) {
      let token = this.getCsrfToken();
      if (!token && !endpoint.includes('/auth/csrf')) {
        try {
          token = await this.fetchCsrfToken();
        } catch {
          // Continue, server double-submit will validate
        }
      }
      if (token) {
        headers['X-CSRF-Token'] = token;
      }
    }

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers,
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network connection error';
      throw new ApiError(msg, 0);
    }

    // Capture returned csrfToken in body if present
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json().catch(() => ({}));
        if (json && json.csrfToken) {
          this.csrfToken = json.csrfToken;
        }
        return json as T;
      }
      return {} as T;
    }

    // Handle 401 Unauthorized with Refresh Token Mutex
    const isAuthRoute =
      endpoint.startsWith('/auth/login') ||
      endpoint.startsWith('/auth/register') ||
      endpoint.startsWith('/auth/refresh') ||
      endpoint.startsWith('/auth/csrf');

    if (response.status === 401 && !isRetry && !isAuthRoute) {
      // If a refresh already finished while this request was in flight, retry immediately
      if (requestStartTime < this.lastRefreshTime) {
        return this.request<T>(endpoint, options, true);
      }

      try {
        await this.executeRefreshMutex();
        // Retry the original request once
        return this.request<T>(endpoint, options, true);
      } catch (refreshErr) {
        throw refreshErr;
      }
    }

    // Parse error body
    let errorMessage = `HTTP ${response.status} Error`;
    let errorData: unknown = null;
    try {
      const json = await response.json();
      errorData = json;
      if (json && typeof json.error === 'string') {
        errorMessage = json.error;
      } else if (json && typeof json.message === 'string') {
        errorMessage = json.message;
      }
    } catch {
      // Body not JSON
    }

    throw new ApiError(errorMessage, response.status, errorData);
  }

  // --- Auth API ---
  public auth = {
    csrf: () => this.fetchCsrfToken(),

    register: (name: string, email: string, password: string) =>
      this.request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),

    login: (email: string, password: string) =>
      this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => this.request<{ user: User }>('/auth/me', { method: 'GET' }),

    refresh: () => this.executeRefreshMutex(),

    logout: async () => {
      try {
        return await this.request<{ message: string }>('/auth/logout', {
          method: 'POST',
        });
      } finally {
        this.csrfToken = null;
      }
    },

    logoutAll: async () => {
      try {
        return await this.request<{ message: string }>('/auth/logout-all', {
          method: 'POST',
        });
      } finally {
        this.csrfToken = null;
      }
    },
  };

  // --- Readings API ---
  public readings = {
    list: (params?: { date?: string; page?: number; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.date) searchParams.set('date', params.date);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));

      const query = searchParams.toString();
      return this.request<ReadingsResponse>(`/readings${query ? `?${query}` : ''}`, {
        method: 'GET',
      });
    },

    get: (id: string) =>
      this.request<ReadingResponse>(`/readings/${id}`, {
        method: 'GET',
      }),

    create: (data: { date: string; slot: TimeSlot; value: number }) =>
      this.request<ReadingResponse>('/readings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: { date: string; slot: TimeSlot; value: number }) =>
      this.request<ReadingResponse>(`/readings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    patch: (id: string, data: Partial<{ date: string; slot: TimeSlot; value: number }>) =>
      this.request<ReadingResponse>(`/readings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<{ message: string }>(`/readings/${id}`, {
        method: 'DELETE',
      }),
  };

  // --- Reports API ---
  public reports = {
    get: (type: ReportType, date?: string) => {
      const searchParams = new URLSearchParams();
      searchParams.set('type', type);
      if (date) searchParams.set('date', date);

      return this.request<ReportResponse>(`/reports?${searchParams.toString()}`, {
        method: 'GET',
      });
    },
  };
}

export const api = new ApiService();

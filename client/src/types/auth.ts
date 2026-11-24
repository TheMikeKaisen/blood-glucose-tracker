export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  csrfToken?: string;
  message?: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

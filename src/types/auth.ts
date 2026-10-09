export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isApproved?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

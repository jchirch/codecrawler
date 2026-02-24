import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export interface User {
  id: number;
  email: string;
  username?: string | null;
  created_at: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';

  currentUser = signal<User | null>(null);
  isAuthenticated = signal(false);

  constructor(private http: HttpClient, private router: Router) {
    // Restore session from localStorage on app load
    const token = this.getToken();
    if (token) {
      this.fetchMe().subscribe({
        error: () => this.clearSession(),
      });
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  register(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/register', { email, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  fetchMe() {
    return this.http.get<{ user: User }>('/api/auth/me').pipe(
      tap((res) => {
        this.currentUser.set(res.user);
        this.isAuthenticated.set(true);
      }),
    );
  }

  updateSettings(username: string) {
    return this.http.patch<{ user: User }>('/api/auth/me', { username }).pipe(
      tap((res) => this.currentUser.set(res.user)),
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private saveSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    this.currentUser.set(res.user);
    this.isAuthenticated.set(true);
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }
}


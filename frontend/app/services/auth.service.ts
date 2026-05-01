import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AppUser {
  id: string;
  email: string;
  createdAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface AuthPayload {
  user: AppUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly userKey = 'stock_analyzer_user';
  private apiUrl = environment.api.baseUrl;
  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  public currentUser$: Observable<AppUser | null> = this.currentUserSubject.asObservable();
  private initializedSubject = new BehaviorSubject<boolean>(false);
  public initialized$ = this.initializedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const cachedUser = localStorage.getItem(this.userKey);
      if (cachedUser) {
        this.currentUserSubject.next(JSON.parse(cachedUser));
      }
      const response = await firstValueFrom(this.http.get<ApiResponse<AuthPayload>>(`${this.apiUrl}/auth/me`));
      if (response.data?.user) {
        this.setUser(response.data.user);
      }
    } catch {
      localStorage.removeItem(this.userKey);
      this.currentUserSubject.next(null);
    } finally {
      this.initializedSubject.next(true);
    }
  }

  async waitForInitialization(): Promise<void> {
    if (this.initializedSubject.value) {
      return;
    }
    await firstValueFrom(this.initialized$.pipe(filter(Boolean), take(1)));
  }

  async signUp(email: string, password: string): Promise<{ user: AppUser | null; error: any }> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<AuthPayload>>(`${this.apiUrl}/auth/signup`, { email, password })
      );
      if (!response.data?.user) {
        throw new Error(response.message || 'Failed to create account');
      }
      this.setUser(response.data.user);
      return { user: response.data.user, error: null };
    } catch (error: any) {
      return { user: null, error: this.normalizeError(error) };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: AppUser | null; error: any }> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<AuthPayload>>(`${this.apiUrl}/auth/signin`, { email, password })
      );
      if (!response.data?.user) {
        throw new Error(response.message || 'Failed to sign in');
      }
      this.setUser(response.data.user);
      return { user: response.data.user, error: null };
    } catch (error: any) {
      return { user: null, error: this.normalizeError(error) };
    }
  }

  async requestPasswordReset(email: string): Promise<{ resetToken?: string; message?: string; error?: any }> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<{ resetToken?: string }>>(`${this.apiUrl}/auth/request-password-reset`, { email })
      );
      return { resetToken: response.data?.resetToken, message: response.message };
    } catch (error: any) {
      return { error: this.normalizeError(error) };
    }
  }

  async resetPassword(token: string, password: string): Promise<{ error?: any }> {
    try {
      await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/auth/reset-password`, { token, password }));
      return {};
    } catch (error: any) {
      return { error: this.normalizeError(error) };
    }
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<ApiResponse<void>>(`${this.apiUrl}/auth/signout`, {}));
    } finally {
      localStorage.removeItem(this.userKey);
      this.currentUserSubject.next(null);
      this.router.navigate(['/login']);
    }
  }

  getCurrentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  getAccessToken(): string | null {
    return null;
  }

  private setUser(user: AppUser): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private normalizeError(error: any): Error {
    const message = error?.error?.detail || error?.error?.message || error?.message || 'Request failed';
    return new Error(message);
  }
}

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { User, Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  private sessionSubject = new BehaviorSubject<Session | null>(null);
  public session$: Observable<Session | null> = this.sessionSubject.asObservable();
  private initializedSubject = new BehaviorSubject<boolean>(false);
  public initialized$ = this.initializedSubject.asObservable();

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    // Initialize auth immediately to restore session from localStorage
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const client = this.supabaseService.client;
      
      // Get session from localStorage (Supabase handles persistence automatically)
      // This will restore the session if it exists
      const { data: { session }, error } = await client.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        this.initializedSubject.next(true);
        return;
      }

      // Update state with restored session
      this.sessionSubject.next(session);
      this.currentUserSubject.next(session?.user ?? null);

      // Listen for auth state changes (sign in, sign out, token refresh, etc.)
      client.auth.onAuthStateChange((_event, session) => {
        this.sessionSubject.next(session);
        this.currentUserSubject.next(session?.user ?? null);
      });

      this.initializedSubject.next(true);
    } catch (error) {
      console.error('Error initializing auth:', error);
      this.initializedSubject.next(true);
    }
  }

  /**
   * Wait for auth initialization to complete
   * Use this in guards to ensure session is restored before checking auth state
   */
  async waitForInitialization(): Promise<void> {
    if (this.initializedSubject.value) {
      return;
    }
    
    await firstValueFrom(
      this.initialized$.pipe(
        filter(initialized => initialized === true),
        take(1)
      )
    );
  }

  async signUp(email: string, password: string): Promise<{ user: User | null; error: any }> {
    try {
      const { data, error } = await this.supabaseService.client.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      return { user: data.user, error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { user: null, error };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; error: any }> {
    try {
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Session is automatically saved to localStorage by Supabase
      return { user: data.user, error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { user: null, error };
    }
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      if (error) throw error;
      
      // Clear session state
      this.sessionSubject.next(null);
      this.currentUserSubject.next(null);
      
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getCurrentSession(): Session | null {
    return this.sessionSubject.value;
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  getAccessToken(): string | null {
    return this.getCurrentSession()?.access_token ?? null;
  }
}
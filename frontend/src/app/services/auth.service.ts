import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
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

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {
    // Use setTimeout to ensure SupabaseService is fully initialized
    // This prevents lock conflicts during initialization
    setTimeout(() => {
      this.initializeAuth();
    }, 0);
  }

  private async initializeAuth(): Promise<void> {
    try {
      const client = this.supabaseService.client;
      
      // Initialize auth state
      const { data: { session } } = await client.auth.getSession();
      this.sessionSubject.next(session);
      this.currentUserSubject.next(session?.user ?? null);

      // Listen for auth changes
      client.auth.onAuthStateChange((_event, session) => {
        this.sessionSubject.next(session);
        this.currentUserSubject.next(session?.user ?? null);
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
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
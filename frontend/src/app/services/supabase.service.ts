import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabaseClient: SupabaseClient | null = null;
  private static clientInstance: SupabaseClient | null = null;

  constructor() {
    // Initialize immediately in constructor to ensure single instance
    this.initializeClient();
  }

  private initializeClient(): void {
    // Use static instance to ensure only one client exists across all instances
    if (SupabaseService.clientInstance) {
      this.supabaseClient = SupabaseService.clientInstance;
      return;
    }

    const supabaseUrl = (environment.supabase?.url || '').trim();
    const supabaseKey = (environment.supabase?.anonKey || '').trim();
    
    // Validate Supabase URL format
    const isValidUrl = this.isValidSupabaseUrl(supabaseUrl);
    const isValidKey = this.isValidSupabaseKey(supabaseKey);
    
    if (!isValidUrl || !isValidKey) {
      const errorMessage = `
Supabase configuration is missing or invalid!

To fix this error:
1. Open: frontend/src/environments/environment.ts
2. Add your Supabase project URL and anonymous key:
   
   supabase: {
     url: 'https://your-project-id.supabase.co',
     anonKey: 'your-anonymous-key-here'
   }

You can find these values in your Supabase project dashboard:
- Go to https://supabase.com/dashboard
- Select your project
- Go to Settings > API
- Copy the "Project URL" and "anon/public" key

Current configuration:
- URL: ${supabaseUrl || '(empty)'}
- Key: ${supabaseKey ? '***' + supabaseKey.slice(-4) : '(empty)'}
      `.trim();
      
      console.error(errorMessage);
      throw new Error('Invalid Supabase configuration. Check console for details.');
    }

    try {
      // Create client with explicit storage key to prevent lock conflicts
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          storageKey: `sb-${supabaseUrl.split('//')[1]?.split('.')[0]}-auth-token`,
          flowType: 'pkce'
        }
      });
      
      // Store in static variable to ensure singleton
      SupabaseService.clientInstance = client;
      this.supabaseClient = client;
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      throw error;
    }
  }

  get client(): SupabaseClient {
    if (!this.supabaseClient) {
      // Fallback: try to initialize if somehow not initialized
      this.initializeClient();
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }
    }
    return this.supabaseClient;
  }

  private isValidSupabaseUrl(url: string): boolean {
    if (!url || url.trim() === '') {
      return false;
    }
    
    // Check for placeholder values
    if (url === 'YOUR_SUPABASE_URL' || url.includes('YOUR_')) {
      return false;
    }
    
    // Must be a valid HTTPS URL
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' && urlObj.hostname.includes('supabase.co');
    } catch {
      return false;
    }
  }

  private isValidSupabaseKey(key: string): boolean {
    if (!key || key.trim() === '') {
      return false;
    }
    
    // Check for placeholder values
    if (key === 'YOUR_SUPABASE_ANON_KEY' || key.includes('YOUR_')) {
      return false;
    }
    
    // Supabase keys are typically long strings (JWT-like)
    return key.length > 20;
  }
}
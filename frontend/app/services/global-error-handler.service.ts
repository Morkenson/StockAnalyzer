import { Injectable, ErrorHandler } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    // Suppress NavigatorLockAcquireTimeoutError from Supabase
    // This is a harmless error that occurs when multiple tabs are open
    // or when the browser's lock manager is busy. Supabase handles it internally.
    if (error?.name === 'NavigatorLockAcquireTimeoutError' || 
        error?.message?.includes('NavigatorLockAcquireTimeoutError') ||
        error?.message?.includes('Navigator LockManager lock')) {
      // Silently ignore - this is expected behavior with Supabase's lock manager
      return;
    }

    // Log other errors normally
    console.error('Global Error Handler:', error);
  }
}





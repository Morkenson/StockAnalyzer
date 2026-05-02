import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-shell" [class.app-shell-full]="!showHeader">
      <app-header *ngIf="showHeader"></app-header>
      <main [class.main-content]="showHeader" [class.main-content-full]="!showHeader">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
      --app-header-height: 76px;
    }

    .app-shell {
      display: block;
      height: 100vh;
      overflow: hidden;
    }

    .app-shell-full {
      display: block;
    }

    app-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--app-header-height);
      z-index: 100;
    }

    .main-content {
      position: fixed;
      top: var(--app-header-height);
      right: 0;
      bottom: 0;
      left: 0;
      padding: var(--spacing-xl);
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
    }

    .main-content-full {
      padding: 0;
      height: 100vh;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
    }

    @media (max-width: 768px) {
      :host {
        --app-header-height: 136px;
      }

      .main-content {
        padding: var(--spacing-lg) var(--spacing-md);
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Mork Wealth';
  showHeader = true;
  private errorHandler?: (event: ErrorEvent) => void;
  private rejectionHandler?: (event: PromiseRejectionEvent) => void;

  constructor(private router: Router) {
    // Hide header on login and signup pages
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.showHeader = !['/login', '/signup'].includes(event.url);
      });
  }

  ngOnInit(): void {
    // Suppress NavigatorLockAcquireTimeoutError from Supabase
    // This is a harmless error that occurs when multiple tabs are open
    // or when the browser's lock manager is busy. Supabase handles it internally.
    this.errorHandler = (event: ErrorEvent) => {
      const error = event.error || event.message || '';
      const errorString = error.toString();
      
      if (errorString.includes('NavigatorLockAcquireTimeoutError') ||
          errorString.includes('Navigator LockManager lock') ||
          errorString.includes('lock:sb-')) {
        event.preventDefault();
        return false;
      }
      return true;
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const errorString = error?.toString() || error?.message || '';
      
      if (errorString.includes('NavigatorLockAcquireTimeoutError') ||
          errorString.includes('Navigator LockManager lock') ||
          errorString.includes('lock:sb-') ||
          error?.name === 'NavigatorLockAcquireTimeoutError') {
        event.preventDefault();
        return false;
      }
      return true;
    };

    window.addEventListener('error', this.errorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  ngOnDestroy(): void {
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
    }
  }
}


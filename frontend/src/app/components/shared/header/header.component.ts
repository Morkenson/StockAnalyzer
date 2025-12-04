import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  template: `
    <header class="header">
      <div class="container">
        <div class="header-content">
          <a routerLink="/dashboard" class="logo" aria-label="Midnight Wealth Home">
            <span class="logo-text">Midnight Wealth</span>
          </a>
          
          <div class="header-search" *ngIf="isAuthenticated">
            <div class="search-input-wrapper">
              
              <input 
                type="text" 
                [formControl]="searchControl"
                placeholder="Search stocks..."
                class="header-search-input"
                (keyup.enter)="onSearch()"
                aria-label="Search stocks">
              <button 
                class="search-button"
                (click)="onSearch()"
                [attr.aria-label]="'Search for ' + searchControl.value"
                [disabled]="!searchControl.value || searchControl.value.trim().length === 0">
                Search
              </button>
            </div>
          </div>

          <nav class="nav" role="navigation" aria-label="Main navigation" *ngIf="isAuthenticated">
            <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
              Dashboard
            </a>
            <a routerLink="/watchlist" routerLinkActive="active">
              Watchlist
            </a>
            <a routerLink="/portfolio" routerLinkActive="active">
              Portfolio
            </a>
          </nav>

          <div class="auth-section">
            <div *ngIf="isAuthenticated && currentUser" class="user-menu-wrapper">
              <button 
                class="user-avatar" 
                (click)="toggleUserMenu()"
                [attr.aria-label]="'User menu for ' + (currentUser.email || 'user')"
                [attr.aria-expanded]="isUserMenuOpen">
                {{ getInitialLetter() }}
              </button>
              <div class="user-dropdown" *ngIf="isUserMenuOpen" #userDropdown>
                <div class="dropdown-header">
                  <div class="dropdown-email">{{ currentUser.email }}</div>
                </div>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" (click)="onLogout()" aria-label="Sign out">
                  Sign Out
                </button>
              </div>
            </div>
            <div *ngIf="!isAuthenticated" class="auth-buttons">
              <a routerLink="/login" class="auth-link">Sign In</a>
              <a routerLink="/signup" class="auth-link auth-link-primary">Sign Up</a>
            </div>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .logo {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      text-decoration: none;
      color: var(--color-text-primary);
      transition: opacity var(--transition-base);
    }

    .logo:hover {
      opacity: 0.8;
    }

    .logo-icon {
      font-size: var(--font-size-2xl);
      line-height: 1;
    }

    .logo-text {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      letter-spacing: -0.02em;
    }

    .header-search {
      flex: 1;
      max-width: 500px;
      margin: 0 var(--spacing-xl);
    }

    .search-input-wrapper {
      display: flex;
      align-items: center;
      background-color: var(--color-bg-tertiary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-xs);
      transition: all var(--transition-base);
      gap: var(--spacing-xs);
    }

    .search-input-wrapper:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      background-color: var(--color-bg-primary);
    }

    .search-icon {
      font-size: var(--font-size-lg);
      color: var(--color-text-tertiary);
      margin-left: var(--spacing-sm);
      pointer-events: none;
    }

    .header-search-input {
      flex: 1;
      border: none;
      background: transparent;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      outline: none;
      font-family: var(--font-family);
    }

    .header-search-input::placeholder {
      color: var(--color-text-tertiary);
    }

    .search-button {
      padding: var(--spacing-sm) var(--spacing-lg);
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: all var(--transition-base);
      white-space: nowrap;
    }

    .search-button:hover:not(:disabled) {
      background-color: var(--color-primary-dark);
      transform: translateY(-1px);
    }

    .search-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .search-button:active:not(:disabled) {
      transform: translateY(0);
    }

    @media (max-width: 1024px) {
      .header-search {
        max-width: 300px;
        margin: 0 var(--spacing-md);
      }
    }

    @media (max-width: 768px) {
      .header-content {
        flex-wrap: wrap;
        gap: var(--spacing-md);
      }

      .header-search {
        order: 3;
        max-width: 100%;
        width: 100%;
        margin: 0;
      }

      .nav {
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }

      .nav a {
        padding: var(--spacing-xs) var(--spacing-sm);
        font-size: var(--font-size-xs);
      }

      .logo-text {
        font-size: var(--font-size-lg);
      }

      .search-button {
        padding: var(--spacing-sm) var(--spacing-md);
        font-size: var(--font-size-xs);
      }
    }

    .auth-section {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      position: relative;
    }

    .user-menu-wrapper {
      position: relative;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--color-primary);
      color: white;
      border: 2px solid var(--color-border);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-base);
      outline: none;
    }

    .user-avatar:hover {
      transform: scale(1.05);
      border-color: var(--color-primary);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .user-avatar:active {
      transform: scale(0.98);
    }

    .user-dropdown {
      position: absolute;
      top: calc(100% + var(--spacing-sm));
      right: 0;
      min-width: 200px;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      overflow: hidden;
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-header {
      padding: var(--spacing-md);
      background: var(--color-bg-tertiary);
    }

    .dropdown-email {
      font-size: var(--font-size-sm);
      color: var(--color-text-primary);
      font-weight: var(--font-weight-medium);
      word-break: break-word;
    }

    .dropdown-divider {
      height: 1px;
      background: var(--color-border);
      margin: var(--spacing-xs) 0;
    }

    .dropdown-item {
      width: 100%;
      padding: var(--spacing-md);
      background: transparent;
      border: none;
      color: var(--color-text-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      text-align: left;
      cursor: pointer;
      transition: background-color var(--transition-base);
      font-family: var(--font-family);
    }

    .dropdown-item:hover {
      background: var(--color-bg-tertiary);
    }

    .dropdown-item:active {
      background: var(--color-bg-secondary);
    }

    .auth-buttons {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .auth-link {
      padding: var(--spacing-sm) var(--spacing-md);
      color: var(--color-text-primary);
      text-decoration: none;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      border-radius: var(--radius-md);
      transition: all var(--transition-base);
    }

    .auth-link:hover {
      background: var(--color-bg-tertiary);
    }

    .auth-link-primary {
      background: var(--color-primary);
      color: white;
      border: 1px solid var(--color-primary);
    }

    .auth-link-primary:hover {
      background: var(--color-primary-dark);
      border-color: var(--color-primary-dark);
    }

    @media (max-width: 768px) {
      .auth-section {
        flex-direction: row;
        gap: var(--spacing-sm);
      }

      .user-avatar {
        width: 32px;
        height: 32px;
        font-size: var(--font-size-xs);
      }

      .user-dropdown {
        right: 0;
        left: auto;
        min-width: 180px;
      }

      .auth-buttons {
        width: 100%;
        justify-content: center;
      }

      .auth-link {
        flex: 1;
        text-align: center;
      }
    }
  `]
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild('userDropdown', { static: false }) userDropdown?: ElementRef;
  
  searchControl = new FormControl('');
  isAuthenticated = false;
  currentUser: User | null = null;
  isUserMenuOpen = false;
  private authSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      this.isAuthenticated = this.authService.isAuthenticated();
      // Close menu when user logs out
      if (!user) {
        this.isUserMenuOpen = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isUserMenuOpen && this.userDropdown) {
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      if (!clickedInside) {
        this.isUserMenuOpen = false;
      }
    }
  }

  getInitialLetter(): string {
    if (!this.currentUser?.email) {
      return '?';
    }
    return this.currentUser.email.charAt(0).toUpperCase();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  onSearch(): void {
    const query = this.searchControl.value?.trim();
    if (query && query.length > 0) {
      this.router.navigate(['/search'], { queryParams: { q: query } });
      // Clear the search input after navigation
      this.searchControl.setValue('');
    }
  }

  async onLogout(): Promise<void> {
    this.isUserMenuOpen = false;
    await this.authService.signOut();
  }
}


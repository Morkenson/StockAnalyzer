import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { AppUser, AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  template: `
    <header class="header" [class.menu-open]="isMobileMenuOpen">
      <div class="container">
        <div class="header-content">
          <a routerLink="/dashboard" class="logo" aria-label="Mork Wealth Home" (click)="closeMobileMenu()">
            <span class="logo-text">Mork Wealth</span>
          </a>

          <button
            *ngIf="isAuthenticated"
            type="button"
            class="menu-toggle"
            (click)="toggleMobileMenu()"
            aria-label="Toggle navigation menu"
            [attr.aria-expanded]="isMobileMenuOpen">
            <span class="menu-toggle-bars" aria-hidden="true">
              <span></span><span></span><span></span>
            </span>
          </button>

          <div class="header-collapse" *ngIf="isAuthenticated">
            <div class="header-search">
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
                  Go
                </button>
              </div>
            </div>

            <nav class="nav" role="navigation" aria-label="Main navigation">
              <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMobileMenu()">
                Dashboard
              </a>
              <a routerLink="/watchlist" routerLinkActive="active" (click)="closeMobileMenu()">
                Watchlist
              </a>
              <a routerLink="/portfolio" routerLinkActive="active" (click)="closeMobileMenu()">
                Portfolio
              </a>
              <a routerLink="/networth" routerLinkActive="active" (click)="closeMobileMenu()">
                Net Worth
              </a>
              <a routerLink="/real-estate" routerLinkActive="active" (click)="closeMobileMenu()">
                Real Estate
              </a>
              <a routerLink="/income-expenses" routerLinkActive="active" (click)="closeMobileMenu()">
                Income
              </a>
              <a routerLink="/taxes" routerLinkActive="active" (click)="closeMobileMenu()">
                Taxes
              </a>
              <a routerLink="/settings" routerLinkActive="active" (click)="closeMobileMenu()">
                Settings
              </a>
            </nav>
          </div>

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
})
export class HeaderComponent implements OnInit, OnDestroy {
  @ViewChild('userDropdown', { static: false }) userDropdown?: ElementRef;
  
  searchControl = new FormControl('');
  isAuthenticated = false;
  currentUser: AppUser | null = null;
  isUserMenuOpen = false;
  isMobileMenuOpen = false;
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe((user: AppUser | null) => {
      this.currentUser = user;
      this.isAuthenticated = this.authService.isAuthenticated();
      // Close menu when user logs out
      if (!user) {
        this.isUserMenuOpen = false;
        this.isMobileMenuOpen = false;
      }
    });

    // Close the mobile menu whenever navigation completes
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isMobileMenuOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.isUserMenuOpen = false;
      this.isMobileMenuOpen = false;
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

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
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


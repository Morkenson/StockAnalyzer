import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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
  styleUrls: ['../../styles/components/shared/header.component.scss']
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


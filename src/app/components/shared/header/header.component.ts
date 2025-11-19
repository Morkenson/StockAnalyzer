import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  template: `
    <header class="header">
      <div class="container">
        <div class="header-content">
          <a routerLink="/dashboard" class="logo" aria-label="Stock Analyzer Home">
            <span class="logo-text">Stock Analyzer</span>
          </a>
          
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
                Search
              </button>
            </div>
          </div>

          <nav class="nav" role="navigation" aria-label="Main navigation">
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
  `]
})
export class HeaderComponent {
  searchControl = new FormControl('');

  constructor(private router: Router) {}

  onSearch(): void {
    const query = this.searchControl.value?.trim();
    if (query && query.length > 0) {
      this.router.navigate(['/search'], { queryParams: { q: query } });
      // Clear the search input after navigation
      this.searchControl.setValue('');
    }
  }
}


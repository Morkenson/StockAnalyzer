import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  template: `
    <app-header *ngIf="showHeader"></app-header>
    <main [class.main-content]="showHeader" [class.main-content-full]="!showHeader">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .main-content {
      padding: var(--spacing-xl) var(--spacing-lg);
      min-height: calc(100vh - 80px);
    }

    .main-content-full {
      padding: 0;
      min-height: 100vh;
    }

    @media (max-width: 768px) {
      .main-content {
        padding: var(--spacing-lg) var(--spacing-md);
      }
    }
  `]
})
export class AppComponent {
  title = 'Midnight Wealth';
  showHeader = true;

  constructor(private router: Router) {
    // Hide header on login and signup pages
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.showHeader = !['/login', '/signup'].includes(event.url);
      });
  }
}


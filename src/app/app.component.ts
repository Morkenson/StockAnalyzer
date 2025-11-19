import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <app-header></app-header>
    <main class="container main-content">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .main-content {
      padding: var(--spacing-xl) var(--spacing-lg);
      min-height: calc(100vh - 80px);
    }

    @media (max-width: 768px) {
      .main-content {
        padding: var(--spacing-lg) var(--spacing-md);
      }
    }
  `]
})
export class AppComponent {
  title = 'Stock Analyzer';
}


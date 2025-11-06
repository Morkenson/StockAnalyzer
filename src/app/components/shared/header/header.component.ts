import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="header">
      <div class="container">
        <div class="header-content">
          <div class="logo">📈 Stock Analyzer</div>
          <nav class="nav">
            <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
            <a routerLink="/search" routerLinkActive="active">Search</a>
            <a routerLink="/watchlist" routerLinkActive="active">Watchlist</a>
            <a routerLink="/portfolio" routerLinkActive="active">Portfolio</a>
            <a routerLink="/settings" routerLinkActive="active">Settings</a>
          </nav>
        </div>
      </div>
    </header>
  `,
  styles: []
})
export class HeaderComponent {
}


import { Component, OnInit } from '@angular/core';
import { SnapTradeService } from '../services/snaptrade.service';
import { Portfolio, Account, Holding } from '../models/snaptrade.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-portfolio',
  template: `
    <div class="portfolio">
      <div class="portfolio-header">
        <h1>My Portfolio</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="initiateAccountLinking()" [disabled]="linkingAccount">
            {{ linkingAccount ? 'Connecting...' : 'Connect Account' }}
          </button>
          <button class="btn btn-primary" (click)="refreshPortfolio()" [disabled]="loading">
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Portfolio Overview -->
      <div class="card" *ngIf="portfolio">
        <div class="card-header">Portfolio Overview</div>
        <div class="portfolio-summary">
          <div class="summary-item">
            <label>Total Balance</label>
            <div class="value">{{ portfolio.currency }}{{ portfolio.totalBalance | number:'1.2-2' }}</div>
          </div>
          <div class="summary-item">
            <label>Total Gain/Loss</label>
            <div class="value" [class.positive]="portfolio.totalGainLoss >= 0" 
                 [class.negative]="portfolio.totalGainLoss < 0">
              {{ portfolio.currency }}{{ portfolio.totalGainLoss >= 0 ? '+' : '' }}{{ portfolio.totalGainLoss | number:'1.2-2' }}
            </div>
          </div>
          <div class="summary-item">
            <label>Gain/Loss %</label>
            <div class="value" [class.positive]="portfolio.totalGainLossPercent >= 0" 
                 [class.negative]="portfolio.totalGainLossPercent < 0">
              {{ portfolio.totalGainLossPercent >= 0 ? '+' : '' }}{{ portfolio.totalGainLossPercent | number:'1.2-2' }}%
            </div>
          </div>
          <div class="summary-item">
            <label>Accounts</label>
            <div class="value">{{ (portfolio.accounts && portfolio.accounts.length) || 0 }}</div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="card" *ngIf="loading && !portfolio">
        <div class="spinner"></div>
        <p style="text-align: center; margin-top: 1rem;">Loading portfolio...</p>
      </div>

      <!-- Error State -->
      <div class="card" *ngIf="error && !loading">
        <div class="error-message">
          <h3>Error Loading Portfolio</h3>
          <p>{{ error }}</p>
          <button class="btn btn-primary" (click)="loadPortfolio()">Retry</button>
        </div>
      </div>

      <!-- Empty State -->
      <div class="card" *ngIf="!portfolio && !loading && !error">
        <div class="empty-state">
          <h3>No Portfolio Found</h3>
          <p>Connect a brokerage account to view your portfolio.</p>
          <button class="btn btn-primary" (click)="initiateAccountLinking()" [disabled]="linkingAccount">
            {{ linkingAccount ? 'Connecting...' : 'Connect Brokerage Account' }}
          </button>
        </div>
      </div>

      <!-- Accounts List -->
      <div *ngIf="portfolio && portfolio.accounts && portfolio.accounts.length > 0">
        <div class="card" *ngFor="let account of portfolio.accounts; let i = index">
          <div class="account-header" (click)="toggleAccount(i)">
            <div class="account-info">
              <h3>{{ account.name }}</h3>
              <p class="account-meta">
                {{ account.accountNumber }} • {{ account.type }}
                <span *ngIf="account.balance !== undefined">
                  • {{ account.currency }}{{ account.balance | number:'1.2-2' }}
                </span>
              </p>
            </div>
            <div class="account-actions">
              <span class="expand-icon" [class.expanded]="expandedAccounts[i]">
                ▼
              </span>
            </div>
          </div>

          <!-- Account Holdings -->
          <div class="account-holdings" *ngIf="expandedAccounts[i]">
            <div *ngIf="!account.holdings || account.holdings.length === 0" class="no-holdings">
              <p>No holdings in this account.</p>
            </div>

            <div *ngIf="account.holdings && account.holdings.length > 0">
              <table class="table holdings-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Quantity</th>
                    <th>Avg Price</th>
                    <th>Current Price</th>
                    <th>Total Value</th>
                    <th>Gain/Loss</th>
                    <th>Gain/Loss %</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let holding of account.holdings">
                    <td>
                      <strong (click)="viewStock(holding.symbol)" 
                              style="cursor: pointer; color: #667eea;">
                        {{ holding.symbol }}
                      </strong>
                    </td>
                    <td>{{ holding.quantity | number:'1.0-2' }}</td>
                    <td>{{ holding.currency }}{{ holding.averagePurchasePrice | number:'1.2-2' }}</td>
                    <td>{{ holding.currency }}{{ holding.currentPrice | number:'1.2-2' }}</td>
                    <td>{{ holding.currency }}{{ holding.totalValue | number:'1.2-2' }}</td>
                    <td [class.positive]="holding.gainLoss >= 0" [class.negative]="holding.gainLoss < 0">
                      {{ holding.currency }}{{ holding.gainLoss >= 0 ? '+' : '' }}{{ holding.gainLoss | number:'1.2-2' }}
                    </td>
                    <td [class.positive]="holding.gainLossPercent >= 0" [class.negative]="holding.gainLossPercent < 0">
                      {{ holding.gainLossPercent >= 0 ? '+' : '' }}{{ holding.gainLossPercent | number:'1.2-2' }}%
                    </td>
                    <td>
                      <button class="btn btn-primary btn-sm" (click)="viewStock(holding.symbol)">View</button>
                    </td>
                  </tr>
                </tbody>
                <tfoot *ngIf="account.holdings && account.holdings.length > 0">
                  <tr class="account-total">
                    <td colspan="4"><strong>Account Total</strong></td>
                    <td><strong>{{ account.currency }}{{ getAccountTotalValue(account) | number:'1.2-2' }}</strong></td>
                    <td [class.positive]="getAccountTotalGainLoss(account) >= 0" 
                        [class.negative]="getAccountTotalGainLoss(account) < 0">
                      <strong>{{ account.currency }}{{ getAccountTotalGainLoss(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLoss(account) | number:'1.2-2' }}</strong>
                    </td>
                    <td [class.positive]="getAccountTotalGainLossPercent(account) >= 0" 
                        [class.negative]="getAccountTotalGainLossPercent(account) < 0">
                      <strong>{{ getAccountTotalGainLossPercent(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLossPercent(account) | number:'1.2-2' }}%</strong>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .portfolio h1 {
      margin-bottom: 2rem;
      color: #333;
    }

    .portfolio-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .btn-secondary {
      background-color: #6c757d;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s;
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: #5a6268;
    }

    .btn-secondary:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }

    .portfolio-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }

    .summary-item {
      text-align: center;
    }

    .summary-item label {
      display: block;
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .summary-item .value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #333;
    }

    .summary-item .value.positive {
      color: #28a745;
    }

    .summary-item .value.negative {
      color: #dc3545;
    }

    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      cursor: pointer;
      transition: background-color 0.2s;
      border-radius: 4px;
    }

    .account-header:hover {
      background-color: #f8f9fa;
    }

    .account-info h3 {
      margin: 0 0 0.25rem 0;
      color: #333;
    }

    .account-meta {
      margin: 0;
      font-size: 0.9rem;
      color: #666;
    }

    .expand-icon {
      font-size: 0.8rem;
      transition: transform 0.3s;
      color: #667eea;
    }

    .expand-icon.expanded {
      transform: rotate(180deg);
    }

    .account-holdings {
      padding: 1rem;
      border-top: 1px solid #eee;
      margin-top: 0.5rem;
    }

    .holdings-table {
      width: 100%;
      margin-top: 1rem;
    }

    .holdings-table th {
      background-color: #f8f9fa;
      font-weight: 600;
      padding: 0.75rem;
      text-align: left;
      border-bottom: 2px solid #dee2e6;
    }

    .holdings-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #eee;
    }

    .holdings-table tbody tr:hover {
      background-color: #f8f9fa;
    }

    .account-total {
      background-color: #f8f9fa;
      font-weight: 600;
    }

    .account-total td {
      padding: 1rem 0.75rem;
      border-top: 2px solid #dee2e6;
    }

    .no-holdings {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .empty-state h3 {
      margin-bottom: 1rem;
      color: #333;
    }

    .empty-state p {
      margin-bottom: 1.5rem;
    }

    .error-message {
      text-align: center;
      padding: 2rem;
    }

    .error-message h3 {
      color: #dc3545;
      margin-bottom: 1rem;
    }

    .error-message p {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }

    .positive {
      color: #28a745;
    }

    .negative {
      color: #dc3545;
    }

    @media (max-width: 768px) {
      .portfolio-summary {
        grid-template-columns: repeat(2, 1fr);
      }

      .holdings-table {
        font-size: 0.85rem;
      }

      .holdings-table th,
      .holdings-table td {
        padding: 0.5rem;
      }
    }
  `]
})
export class PortfolioComponent implements OnInit {
  portfolio: Portfolio | null = null;
  loading = false;
  error: string | null = null;
  linkingAccount = false;
  expandedAccounts: { [key: number]: boolean } = {};

  // No need for userId/userSecret - backend handles authentication

  constructor(
    private snapTradeService: SnapTradeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPortfolio();
  }

  loadPortfolio(): void {
    this.loading = true;
    this.error = null;

    // Backend handles user identification via authentication
    this.snapTradeService.getPortfolio().subscribe({
      next: (portfolio) => {
        this.portfolio = portfolio;
        this.loading = false;
        // Auto-expand first account by default
        if (portfolio.accounts && portfolio.accounts.length > 0) {
          this.expandedAccounts[0] = true;
        }
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to load portfolio. Please check your SnapTrade connection.';
        this.loading = false;
        console.error('Error loading portfolio:', err);
      }
    });
  }

  refreshPortfolio(): void {
    this.loadPortfolio();
  }

  toggleAccount(index: number): void {
    this.expandedAccounts[index] = !this.expandedAccounts[index];
  }

  viewStock(symbol: string): void {
    this.router.navigate(['/stock', symbol]);
  }

  getAccountTotalValue(account: Account): number {
    if (!account.holdings || account.holdings.length === 0) {
      return 0;
    }
    return account.holdings.reduce((sum, holding) => sum + holding.totalValue, 0);
  }

  getAccountTotalGainLoss(account: Account): number {
    if (!account.holdings || account.holdings.length === 0) {
      return 0;
    }
    return account.holdings.reduce((sum, holding) => sum + holding.gainLoss, 0);
  }

  getAccountTotalGainLossPercent(account: Account): number {
    const totalValue = this.getAccountTotalValue(account);
    const totalGainLoss = this.getAccountTotalGainLoss(account);
    if (totalValue === 0) {
      return 0;
    }
    return (totalGainLoss / (totalValue - totalGainLoss)) * 100;
  }

  /**
   * Initiate SnapTrade account linking process
   * This will redirect the user to their brokerage's OAuth page
   * Backend handles user creation and connection initiation
   */
  initiateAccountLinking(): void {
    this.linkingAccount = true;
    this.error = null;

    // Backend handles user creation and retrieves stored userSecret
    this.snapTradeService.initiateConnection().subscribe({
      next: (connectionResponse) => {
        if (connectionResponse.redirectUri) {
          // Redirect to brokerage OAuth page
          window.location.href = connectionResponse.redirectUri;
        } else {
          this.error = 'No redirect URL received. Please try again.';
          this.linkingAccount = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to initiate account connection. Please try again.';
        this.linkingAccount = false;
        console.error('Error initiating connection:', err);
      }
    });
  }
}


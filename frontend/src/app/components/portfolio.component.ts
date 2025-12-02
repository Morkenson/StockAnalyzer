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
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading portfolio...</p>
        </div>
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

            <div *ngIf="account.holdings && account.holdings.length > 0" class="table-wrapper">
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
                      <button 
                        class="symbol-link"
                        (click)="viewStock(holding.symbol)"
                        [attr.aria-label]="'View details for ' + holding.symbol">
                        <strong>{{ holding.symbol }}</strong>
                      </button>
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
    .portfolio {
      padding: var(--spacing-xl) 0;
    }

    .portfolio-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--spacing-2xl);
      gap: var(--spacing-lg);
    }

    .portfolio-header h1 {
      margin-bottom: 0;
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-md);
      flex-wrap: wrap;
    }

    .portfolio-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacing-lg);
      margin-top: var(--spacing-md);
    }

    .summary-item {
      text-align: center;
      padding: var(--spacing-lg);
      background-color: var(--color-bg-tertiary);
      border-radius: var(--radius-md);
      transition: transform var(--transition-base);
    }

    .summary-item:hover {
      transform: translateY(-2px);
    }

    .summary-item label {
      display: block;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-sm);
      font-weight: var(--font-weight-medium);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .summary-item .value {
      font-size: var(--font-size-2xl);
      font-weight: var(--font-weight-bold);
      color: var(--color-text-primary);
      letter-spacing: -0.02em;
    }

    .summary-item .value.positive {
      color: var(--color-success);
    }

    .summary-item .value.negative {
      color: var(--color-danger);
    }

    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-lg);
      cursor: pointer;
      transition: all var(--transition-base);
      border-radius: var(--radius-md);
      user-select: none;
    }

    .account-header:hover {
      background-color: var(--color-bg-tertiary);
    }

    .account-header:active {
      transform: scale(0.98);
    }

    .account-info {
      flex: 1;
    }

    .account-info h3 {
      margin: 0 0 var(--spacing-xs) 0;
      color: var(--color-text-primary);
      font-size: var(--font-size-xl);
    }

    .account-meta {
      margin: 0;
      font-size: var(--font-size-sm);
      color: var(--color-text-secondary);
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
      align-items: center;
    }

    .account-actions {
      display: flex;
      align-items: center;
    }

    .expand-icon {
      font-size: var(--font-size-sm);
      transition: transform var(--transition-base);
      color: var(--color-primary);
      display: inline-block;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .expand-icon.expanded {
      transform: rotate(180deg);
    }

    .account-holdings {
      padding: var(--spacing-lg);
      border-top: 1px solid var(--color-border-light);
      margin-top: var(--spacing-md);
      animation: slideDown var(--transition-slow) ease-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .holdings-table {
      width: 100%;
      margin-top: var(--spacing-md);
    }

    .holdings-table th {
      background-color: var(--color-bg-tertiary);
      font-weight: var(--font-weight-semibold);
      padding: var(--spacing-md);
      text-align: left;
      border-bottom: 2px solid var(--color-border);
    }

    .holdings-table td {
      padding: var(--spacing-md);
      border-bottom: 1px solid var(--color-border-light);
    }

    .holdings-table tbody tr {
      transition: background-color var(--transition-fast);
    }

    .holdings-table tbody tr:hover {
      background-color: var(--color-bg-tertiary);
    }

    .holdings-table tbody tr td strong {
      color: var(--color-primary);
      font-weight: var(--font-weight-semibold);
      cursor: pointer;
      transition: color var(--transition-base);
    }

    .holdings-table tbody tr td strong:hover {
      color: var(--color-primary-dark);
      text-decoration: underline;
    }

    .account-total {
      background-color: var(--color-bg-tertiary);
      font-weight: var(--font-weight-semibold);
    }

    .account-total td {
      padding: var(--spacing-lg) var(--spacing-md);
      border-top: 2px solid var(--color-border);
    }

    .no-holdings {
      text-align: center;
      padding: var(--spacing-2xl);
      color: var(--color-text-secondary);
    }

    .empty-state {
      text-align: center;
      padding: var(--spacing-3xl) var(--spacing-xl);
      color: var(--color-text-secondary);
    }

    .empty-state h3 {
      margin-bottom: var(--spacing-md);
      color: var(--color-text-primary);
    }

    .empty-state p {
      margin-bottom: var(--spacing-lg);
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .error-message {
      text-align: center;
      padding: var(--spacing-xl);
    }

    .error-message h3 {
      color: var(--color-danger);
      margin-bottom: var(--spacing-md);
    }

    .error-message p {
      color: var(--color-text-secondary);
      margin-bottom: var(--spacing-lg);
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-2xl) 0;
    }

    .loading-state p {
      color: var(--color-text-secondary);
      margin: 0;
    }

    .symbol-link {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
    }

    .symbol-link:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }

    .positive {
      color: var(--color-success);
      font-weight: var(--font-weight-medium);
    }

    .negative {
      color: var(--color-danger);
      font-weight: var(--font-weight-medium);
    }

    @media (max-width: 768px) {
      .portfolio {
        padding: var(--spacing-lg) 0;
      }

      .portfolio-header {
        flex-direction: column;
        margin-bottom: var(--spacing-xl);
      }

      .header-actions {
        width: 100%;
      }

      .header-actions .btn {
        flex: 1;
      }

      .portfolio-summary {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--spacing-md);
      }

      .summary-item {
        padding: var(--spacing-md);
      }

      .summary-item .value {
        font-size: var(--font-size-xl);
      }

      .holdings-table {
        font-size: var(--font-size-xs);
      }

      .holdings-table th,
      .holdings-table td {
        padding: var(--spacing-sm);
      }

      .account-header {
        padding: var(--spacing-md);
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


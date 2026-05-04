import { Component, OnInit } from '@angular/core';
import { SnapTradeService } from '../services/snaptrade.service';
import { Portfolio, Account, RecurringInvestment } from '../models/snaptrade.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-portfolio',
  template: `
    <div class="portfolio">
      <section class="page-hero portfolio-hero">
        <div>
          <p class="page-kicker">Portfolio</p>
          <h1>{{ portfolio ? formatMoney(portfolio.totalBalance) : 'My Portfolio' }}</h1>
          <p class="page-subtitle">{{ portfolio ? 'Your connected accounts in one place.' : 'Connect a brokerage account to see your investments.' }}</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="initiateAccountLinking()" [disabled]="linkingAccount">
            {{ linkingAccount ? 'Connecting...' : (portfolio ? 'Connect another account' : 'Connect account') }}
          </button>
          <button class="btn btn-primary" (click)="refreshPortfolio()" [disabled]="loading">
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </section>

      <!-- Portfolio Overview -->
      <section class="card" *ngIf="portfolio">
        <div class="card-header">
          <div>
            <span>Overview</span>
            <p>Balance and performance summary</p>
          </div>
        </div>
        <div class="portfolio-summary">
          <div class="summary-item">
            <label>Total Balance</label>
            <div class="value">{{ formatMoney(portfolio.totalBalance) }}</div>
          </div>
          <div class="summary-item">
            <label>Total Gain/Loss</label>
            <div class="value" [class.positive]="portfolio.totalGainLoss >= 0" 
                 [class.negative]="portfolio.totalGainLoss < 0">
              {{ formatMoney(portfolio.totalGainLoss, true) }}
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
      </section>

      <section class="card recurring-investments-card" *ngIf="portfolio && (recurringLoading || recurringInvestments.length > 0 || recurringError)">
        <div class="card-header">
          <div>
            <span>Recurring Buys</span>
            <p>Likely schedules from recent buy activity</p>
          </div>
        </div>
        <div class="loading-state compact" *ngIf="recurringLoading">
          <div class="spinner"></div>
          <p>Checking recurring buys...</p>
        </div>
        <div class="error-message compact" *ngIf="recurringError && !recurringLoading">
          <p>{{ recurringError }}</p>
        </div>
        <div class="recurring-investment-list" *ngIf="!recurringLoading && recurringInvestments.length > 0">
          <div class="recurring-investment-item" *ngFor="let investment of recurringInvestments">
            <div>
              <strong>{{ investment.symbol }}</strong>
              <p>{{ investment.accountName }}</p>
            </div>
            <div class="recurring-investment-metric">
              <span>{{ titleCase(investment.frequency) }}</span>
              <strong>{{ formatMoney(investment.amount) }}</strong>
            </div>
            <div class="recurring-investment-metric">
              <span>Next est.</span>
              <strong>{{ formatDate(investment.nextEstimatedDate) }}</strong>
            </div>
            <div class="recurring-investment-metric">
              <span>Seen</span>
              <strong>{{ investment.occurrences }}</strong>
            </div>
          </div>
        </div>
      </section>

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
      <section class="accounts-section" *ngIf="portfolio && portfolio.accounts && portfolio.accounts.length > 0">
        <div class="section-heading">
          <h2>Accounts</h2>
          <p>{{ portfolio.accounts.length }} connected {{ portfolio.accounts.length === 1 ? 'account' : 'accounts' }}</p>
        </div>
        <div class="card" *ngFor="let account of portfolio.accounts; let i = index">
          <div class="account-header" (click)="toggleAccount(i)">
            <div class="account-action-rail" (click)="$event.stopPropagation()">
              <button
                class="account-icon-btn"
                type="button"
                title="Rename account"
                aria-label="Rename account"
                (click)="startNicknameEdit(account, $event)"
                [disabled]="savingAccountId === account.id || removingAccountId === account.id">
                <span aria-hidden="true">&#9998;</span>
              </button>
              <button
                class="account-icon-btn danger"
                type="button"
                title="Remove account"
                aria-label="Remove account"
                (click)="removeAccount(account, $event)"
                [disabled]="savingAccountId === account.id || removingAccountId === account.id">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="account-info">
              <h3>{{ account.nickname || account.name }}</h3>
              <p class="account-meta">
                <span *ngIf="account.nickname">{{ account.name }} / </span>{{ account.accountNumber }} / {{ account.type }}
                <span *ngIf="account.balance !== undefined">
                  / {{ formatMoney(account.balance) }}
                </span>
              </p>
            </div>
            <div class="account-expand">
              <span class="expand-icon" [class.expanded]="expandedAccounts[i]">
                V
              </span>
            </div>
          </div>
          <div class="account-preferences" *ngIf="editingNicknameAccountId === account.id" (click)="$event.stopPropagation()">
            <label [attr.for]="'nickname-' + account.id">Nickname</label>
            <div class="account-preference-row">
              <input
                [id]="'nickname-' + account.id"
                class="form-input"
                type="text"
                maxlength="80"
                [(ngModel)]="nicknameDrafts[account.id]"
                [placeholder]="account.name"
                (keydown.enter)="saveNickname(account)"
                (keydown.escape)="cancelNicknameEdit()" />
              <button class="btn btn-primary" type="button" (click)="saveNickname(account)" [disabled]="savingAccountId === account.id">
                {{ savingAccountId === account.id ? 'Saving...' : 'Save' }}
              </button>
              <button class="btn btn-secondary" type="button" (click)="cancelNicknameEdit()" [disabled]="savingAccountId === account.id">
                Cancel
              </button>
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
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let holding of account.holdings"
                      (click)="viewStock(holding.symbol)"
                      [attr.aria-label]="'View details for ' + holding.symbol">
                    <td>
                      <strong>{{ holding.symbol }}</strong>
                    </td>
                    <td>{{ holding.quantity | number:'1.0-2' }}</td>
                    <td>{{ formatMoney(holding.averagePurchasePrice) }}</td>
                    <td>{{ formatMoney(holding.currentPrice) }}</td>
                    <td>{{ formatMoney(holding.totalValue) }}</td>
                    <td [class.positive]="holding.gainLoss >= 0" [class.negative]="holding.gainLoss < 0">
                      {{ formatMoney(holding.gainLoss, true) }}
                    </td>
                    <td [class.positive]="holding.gainLossPercent >= 0" [class.negative]="holding.gainLossPercent < 0">
                      {{ holding.gainLossPercent >= 0 ? '+' : '' }}{{ holding.gainLossPercent | number:'1.2-2' }}%
                    </td>
                  </tr>
                </tbody>
                <tfoot *ngIf="account.holdings && account.holdings.length > 0">
                  <tr class="account-total">
                    <td colspan="4"><strong>Account Total</strong></td>
                    <td><strong>{{ formatMoney(getAccountTotalValue(account)) }}</strong></td>
                    <td [class.positive]="getAccountTotalGainLoss(account) >= 0" 
                        [class.negative]="getAccountTotalGainLoss(account) < 0">
                      <strong>{{ formatMoney(getAccountTotalGainLoss(account), true) }}</strong>
                    </td>
                    <td [class.positive]="getAccountTotalGainLossPercent(account) >= 0" 
                        [class.negative]="getAccountTotalGainLossPercent(account) < 0">
                      <strong>{{ getAccountTotalGainLossPercent(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLossPercent(account) | number:'1.2-2' }}%</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class PortfolioComponent implements OnInit {
  portfolio: Portfolio | null = null;
  loading = false;
  error: string | null = null;
  recurringInvestments: RecurringInvestment[] = [];
  recurringLoading = false;
  recurringError: string | null = null;
  linkingAccount = false;
  editingNicknameAccountId: string | null = null;
  savingAccountId: string | null = null;
  removingAccountId: string | null = null;
  nicknameDrafts: { [accountId: string]: string } = {};
  expandedAccounts: { [key: number]: boolean } = {};
  private readonly moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // No need for userId/userSecret - backend handles authentication

  constructor(
    private snapTradeService: SnapTradeService,
    private router: Router
  ) {}

  formatMoney(value: number | null | undefined, showSign = false): string {
    const amount = value || 0;
    const sign = showSign && amount >= 0 ? '+' : '';
    return `${sign}${this.moneyFormatter.format(amount)}`;
  }

  titleCase(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'TBD';
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
      new Date(`${value}T00:00:00`)
    );
  }

  ngOnInit(): void {
    this.loadPortfolio();
  }

  loadPortfolio(refresh = false): void {
    this.loading = true;
    this.error = null;

    // Backend handles user identification via authentication
    this.snapTradeService.getPortfolio(refresh).subscribe({
      next: (portfolio) => {
        this.portfolio = portfolio;
        this.loading = false;
        this.loadRecurringInvestments(refresh);
        // Auto-expand first account by default
        if (portfolio.accounts && portfolio.accounts.length > 0) {
          this.expandedAccounts[0] = true;
        }
      },
      error: (err) => {
        if (err.status === 404) {
          this.portfolio = null;
          this.error = null;
          this.recurringInvestments = [];
          this.loading = false;
          return;
        }
        this.error = err.error?.message || err.message || 'Failed to load portfolio. Please check your SnapTrade connection.';
        this.loading = false;
        console.error('Error loading portfolio:', err);
      }
    });
  }

  loadRecurringInvestments(refresh = false): void {
    this.recurringLoading = true;
    this.recurringError = null;

    this.snapTradeService.getRecurringInvestments(refresh).subscribe({
      next: (investments) => {
        this.recurringInvestments = investments;
        this.recurringLoading = false;
      },
      error: (err) => {
        this.recurringInvestments = [];
        this.recurringError = err.error?.message || err.message || 'Failed to load recurring buys.';
        this.recurringLoading = false;
        console.error('Error loading recurring investments:', err);
      }
    });
  }

  refreshPortfolio(): void {
    this.loadPortfolio(true);
  }

  toggleAccount(index: number): void {
    this.expandedAccounts[index] = !this.expandedAccounts[index];
  }

  viewStock(symbol: string): void {
    this.router.navigate(['/stock', symbol]);
  }

  startNicknameEdit(account: Account, event: Event): void {
    event.stopPropagation();
    this.editingNicknameAccountId = account.id;
    this.nicknameDrafts[account.id] = account.nickname || account.name || '';
  }

  cancelNicknameEdit(): void {
    this.editingNicknameAccountId = null;
  }

  saveNickname(account: Account): void {
    const nickname = (this.nicknameDrafts[account.id] || '').trim();
    this.savingAccountId = account.id;
    this.error = null;

    this.snapTradeService.updateAccountPreference(account.id, { nickname }).subscribe({
      next: (preference) => {
        account.nickname = preference.nickname || null;
        this.editingNicknameAccountId = null;
        this.savingAccountId = null;
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to update account nickname.';
        this.savingAccountId = null;
        console.error('Error updating account nickname:', err);
      }
    });
  }

  removeAccount(account: Account, event: Event): void {
    event.stopPropagation();
    const label = account.nickname || account.name || 'this account';
    if (!window.confirm(`Remove ${label} from this portfolio view?`)) {
      return;
    }

    this.removingAccountId = account.id;
    this.error = null;

    this.snapTradeService.hideAccount(account.id).subscribe({
      next: () => {
        this.removingAccountId = null;
        this.loadPortfolio();
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to remove account.';
        this.removingAccountId = null;
        console.error('Error removing account:', err);
      }
    });
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


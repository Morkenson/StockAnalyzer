import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { SnapTradeService } from '../services/snaptrade.service';
import { Portfolio, Account, DividendIncomeAccount, DividendIncomeSummary, Holding, RecurringInvestment } from '../models/snaptrade.model';
import { Router } from '@angular/router';
import { StockHistoricalData } from '../models/stock.model';

type ChartRange = {
  daysBack: number;
  label: string;
};

type FutureProjection = {
  label: string;
  years: number;
  value: number;
  annualIncome: number;
  monthlyIncome: number;
};

type BrokerageBrand = {
  key: string;
  name: string;
  logoText: string;
  tone: string;
};

type AccountCompanyGroup = BrokerageBrand & {
  accounts: Account[];
  totalValue: number;
  totalGainLoss: number;
  holdingCount: number;
};

@Component({
  selector: 'app-portfolio',
  template: `
    <div class="portfolio">
      <section class="page-hero portfolio-hero">
        <div class="portfolio-hero-main">
          <div class="portfolio-hero-copy">
            <p class="page-kicker">Portfolio</p>
            <h1>{{ portfolio ? formatMoney(portfolio.totalBalance) : 'My Portfolio' }}</h1>
            <p class="page-subtitle">{{ portfolio ? 'Your connected accounts in one place.' : 'Connect a brokerage account to see your investments.' }}</p>
          </div>
          <div class="portfolio-hero-summary" *ngIf="portfolio" aria-label="Portfolio all-time summary">
            <div class="summary-item">
              <label>All-time Gain/Loss</label>
              <div class="value" [class.positive]="portfolio.totalGainLoss >= 0"
                   [class.negative]="portfolio.totalGainLoss < 0">
                {{ formatMoney(portfolio.totalGainLoss, true) }}
                ({{ portfolio.totalGainLossPercent >= 0 ? '+' : '' }}{{ portfolio.totalGainLossPercent | number:'1.2-2' }}%)
              </div>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary future-toggle-btn" type="button" (click)="toggleFuture()" [disabled]="!portfolio || futureLoading">
            {{ futureLoading ? 'Loading...' : 'Future' }}
          </button>
          <button class="btn btn-secondary" (click)="initiateAccountLinking()" [disabled]="linkingAccount">
            {{ linkingAccount ? 'Connecting...' : (portfolio ? 'Connect another account' : 'Connect account') }}
          </button>
          <button class="btn btn-primary" (click)="refreshPortfolio()" [disabled]="loading">
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </section>

      <section class="card portfolio-future-card" *ngIf="portfolio && showFuture">
        <div class="future-card-header">
          <div>
            <span class="chart-eyebrow">Future Pace</span>
            <h2>Projected Portfolio</h2>
          </div>
          <button class="account-icon-btn" type="button" title="Close future estimate" aria-label="Close future estimate" (click)="showFuture = false">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div class="future-loading" *ngIf="futureLoading">
          <div class="spinner"></div>
          <p>Estimating your future pace...</p>
        </div>

        <div class="compact-empty" *ngIf="futureError && !futureLoading">
          <p>{{ futureError }}</p>
          <button class="btn btn-primary" type="button" (click)="loadFutureEstimate(true)">Try again</button>
        </div>

        <ng-container *ngIf="!futureLoading && !futureError">
          <div class="future-summary-grid">
            <div class="future-summary-item">
              <label>Monthly Contributions</label>
              <strong>{{ formatMoney(monthlyRecurringInvestment) }}</strong>
            </div>
            <div class="future-summary-item">
              <label>Current Annual Income</label>
              <strong>{{ formatMoney(currentAnnualDividendIncome) }}</strong>
            </div>
            <div class="future-summary-item">
              <label>Income Yield</label>
              <strong>{{ currentDividendYield | number:'1.2-2' }}%</strong>
            </div>
          </div>

          <div class="future-projection-grid" aria-label="Future portfolio estimates">
            <div class="future-projection" *ngFor="let projection of futureProjections">
              <span>{{ projection.label }}</span>
              <strong>{{ formatMoney(projection.value) }}</strong>
              <small>{{ formatMoney(projection.monthlyIncome) }}/mo income</small>
              <small>{{ formatMoney(projection.annualIncome) }}/yr income</small>
            </div>
          </div>
        </ng-container>
      </section>

      <section class="card account-balance-chart-card portfolio-chart-card" *ngIf="portfolio">
        <div class="stock-chart-section portfolio-chart-section">
          <div class="chart-topline">
            <div>
              <span class="chart-eyebrow">Balance History</span>
              <strong [class.positive]="chartChange >= 0" [class.negative]="chartChange < 0">
                {{ chartChange >= 0 ? '+' : '' }}{{ chartChange | currency:'USD':'symbol':'1.2-2' }}
                <span>({{ chartChangePercent >= 0 ? '+' : '' }}{{ chartChangePercent | number:'1.2-2' }}%)</span>
              </strong>
            </div>
            <div class="chart-topline-actions">
              <span class="chart-range-label">{{ selectedRange.label }}</span>
              <div class="chart-source-toggle" role="group" aria-label="Balance history source">
                <button
                  type="button"
                  class="chart-source-option"
                  [class.active]="historySource === 'snapshots'"
                  [disabled]="balanceHistoryLoading"
                  (click)="setHistorySource('snapshots')">
                  Saved
                </button>
                <button
                  type="button"
                  class="chart-source-option"
                  [class.active]="historySource === 'brokerage'"
                  [disabled]="balanceHistoryLoading"
                  title="Live history from your brokerage (SnapTrade Pro). Not saved."
                  (click)="setHistorySource('brokerage')">
                  Brokerage
                </button>
              </div>
            </div>
          </div>
          <p class="chart-backfill-note" *ngIf="historyMessage">{{ historyMessage }}</p>
          <app-stock-chart
            [historicalData]="balanceHistory"
            valueLabel="Balance"
            ariaLabel="Portfolio balance history chart">
          </app-stock-chart>
          <div class="chart-range-tabs" role="tablist" aria-label="Portfolio balance chart timeframe">
            <button
              *ngFor="let range of chartRanges"
              type="button"
              role="tab"
              class="chart-range-tab"
              [class.active]="range.label === selectedRange.label"
              [attr.aria-selected]="range.label === selectedRange.label"
              [disabled]="balanceHistoryLoading && range.label === selectedRange.label"
              (click)="selectRange(range)">
              {{ range.label }}
            </button>
          </div>
          <div class="chart-loading" *ngIf="balanceHistoryLoading">Updating chart...</div>
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
        <section class="account-company-group" *ngFor="let group of accountGroups" [attr.aria-label]="group.name + ' accounts'">
          <button
            class="account-company-group-header"
            type="button"
            [id]="getAccountGroupHeaderElementId(group.key)"
            [attr.aria-expanded]="isAccountGroupExpanded(group.key)"
            [attr.aria-controls]="getAccountGroupElementId(group.key)"
            (click)="toggleAccountGroup(group.key)">
            <div
              class="account-company-logo"
              [ngClass]="'account-company-logo-' + group.tone"
              [attr.aria-label]="group.name + ' logo'">
              <span aria-hidden="true">{{ group.logoText }}</span>
            </div>
            <div class="account-company-title">
              <h3>{{ group.name }}</h3>
              <p>{{ group.accounts.length }} {{ group.accounts.length === 1 ? 'account' : 'accounts' }}</p>
            </div>
            <div class="account-company-summary" aria-label="Company account summary">
              <div>
                <span>Total Value</span>
                <strong>{{ formatMoney(group.totalValue) }}</strong>
              </div>
              <div>
                <span>Gain/Loss</span>
                <strong [class.positive]="group.totalGainLoss >= 0" [class.negative]="group.totalGainLoss < 0">
                  {{ formatMoney(group.totalGainLoss, true) }}
                </strong>
              </div>
              <div>
                <span>Holdings</span>
                <strong>{{ group.holdingCount }}</strong>
              </div>
            </div>
            <span class="expand-icon" [class.expanded]="isAccountGroupExpanded(group.key)" aria-hidden="true">&rsaquo;</span>
          </button>

          <div
            class="account-company-account-list"
            *ngIf="isAccountGroupExpanded(group.key)"
            [id]="getAccountGroupElementId(group.key)">
            <article class="account-row-shell" *ngFor="let account of group.accounts">
              <div
                class="account-header"
                role="button"
                tabindex="0"
                (click)="viewAccount(account)"
                (keydown.enter)="viewAccount(account)"
                (keydown.space)="viewAccount(account); $event.preventDefault()">
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
                <div
                  class="account-company-logo"
                  [ngClass]="getBrokerageLogoClass(account)"
                  [attr.aria-label]="getBrokerageBrand(account).name + ' logo'">
                  <span aria-hidden="true">{{ getBrokerageLogoText(account) }}</span>
                </div>
                <div class="account-info">
                  <h3>{{ account.nickname || account.name }}</h3>
                  <p class="account-meta">
                    <span *ngIf="account.nickname">{{ account.name }} / </span>{{ account.accountNumber }} / {{ account.type }}
                  </p>
                  <div class="account-card-stats" aria-label="Account core stats">
                    <div class="account-card-stat">
                      <span>Total Value</span>
                      <strong>{{ formatMoney(getAccountDisplayValue(account)) }}</strong>
                    </div>
                    <div class="account-card-stat">
                      <span>Gain/Loss</span>
                      <strong [class.positive]="getAccountTotalGainLoss(account) >= 0" [class.negative]="getAccountTotalGainLoss(account) < 0">
                        {{ formatMoney(getAccountTotalGainLoss(account), true) }}
                        ({{ getAccountTotalGainLossPercent(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLossPercent(account) | number:'1.2-2' }}%)
                      </strong>
                    </div>
                    <div class="account-card-stat">
                      <span>Allocation</span>
                      <strong>{{ getPortfolioAllocation(account) | number:'1.2-2' }}%</strong>
                    </div>
                    <div class="account-card-stat">
                      <span>Holdings</span>
                      <strong>
                        {{ account.holdings?.length || 0 }}
                        <small *ngIf="getLargestHolding(account) as largest">({{ largest.symbol }})</small>
                      </strong>
                    </div>
                    <div class="account-card-stat" *ngIf="getAccountDividendIncome(account) as dividend">
                      <span>Monthly Div</span>
                      <strong>{{ formatDividendMoney(dividend.monthlyIncome, dividend.currency) }}</strong>
                    </div>
                    <div class="account-card-stat" *ngIf="getAccountMonthlyRecurringBuys(account) > 0">
                      <span>Monthly Recur</span>
                      <strong>{{ formatMoney(getAccountMonthlyRecurringBuys(account)) }}</strong>
                    </div>
                  </div>
                </div>
                <div class="account-expand">
                  <span class="expand-icon">
                    &rsaquo;
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
            </article>
          </div>
        </section>
      </section>
    </div>
  `,
})
export class PortfolioComponent implements OnInit {
  portfolio: Portfolio | null = null;
  loading = false;
  error: string | null = null;
  linkingAccount = false;
  editingNicknameAccountId: string | null = null;
  savingAccountId: string | null = null;
  removingAccountId: string | null = null;
  nicknameDrafts: { [accountId: string]: string } = {};
  accountGroups: AccountCompanyGroup[] = [];
  expandedAccountGroupKeys: { [groupKey: string]: boolean } = {};
  balanceHistory: StockHistoricalData[] = [];
  balanceHistoryLoading = false;
  chartChange = 0;
  chartChangePercent = 0;
  showFuture = false;
  futureLoading = false;
  futureError: string | null = null;
  recurringInvestments: RecurringInvestment[] = [];
  dividendIncome: DividendIncomeSummary | null = null;
  monthlyRecurringInvestment = 0;
  currentAnnualDividendIncome = 0;
  currentDividendYield = 0;
  futureProjections: FutureProjection[] = [];
  chartRanges: ChartRange[] = [
    { label: '1W', daysBack: 7 },
    { label: '1M', daysBack: 30 },
    { label: '3M', daysBack: 90 },
    { label: '1Y', daysBack: 365 },
    { label: '5Y', daysBack: 365 * 5 },
    { label: 'All', daysBack: Number.POSITIVE_INFINITY }
  ];
  selectedRange = this.chartRanges[1];
  private allBalanceHistory: StockHistoricalData[] = [];
  private readonly moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  private readonly brokerageBrands = [
    { key: 'webull', name: 'Webull', logoText: 'W', tone: 'webull' },
    { key: 'robinhood', name: 'Robinhood', logoText: 'RH', tone: 'robinhood' },
    { key: 'fidelity', name: 'Fidelity', logoText: 'F', tone: 'fidelity' },
    { key: 'schwab', name: 'Charles Schwab', logoText: 'CS', tone: 'schwab' },
    { key: 'vanguard', name: 'Vanguard', logoText: 'V', tone: 'vanguard' },
    { key: 'etrade', name: 'E*TRADE', logoText: 'E', tone: 'etrade' },
    { key: 'e*trade', name: 'E*TRADE', logoText: 'E', tone: 'etrade' },
    { key: 'td ameritrade', name: 'TD Ameritrade', logoText: 'TD', tone: 'td' },
    { key: 'interactive brokers', name: 'Interactive Brokers', logoText: 'IB', tone: 'interactive-brokers' },
    { key: 'coinbase', name: 'Coinbase', logoText: 'C', tone: 'coinbase' },
    { key: 'alpaca', name: 'Alpaca', logoText: 'A', tone: 'alpaca' },
    { key: 'wealthsimple', name: 'Wealthsimple', logoText: 'WS', tone: 'wealthsimple' }
  ];

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

  formatDividendMoney(value: number | null | undefined, currency: string | null | undefined): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(value || 0);
  }

  getBrokerageBrand(account: Account): BrokerageBrand {
    const searchable = `${account.nickname || ''} ${account.name || ''} ${account.brokerageId || ''}`.toLowerCase();
    const brand = this.brokerageBrands.find(item => searchable.includes(item.key));

    if (brand) {
      return brand;
    }

    return {
      key: this.getBrokerageFallbackKey(account),
      name: account.name || 'Brokerage',
      logoText: this.getBrokerageInitials(account.name || 'Brokerage'),
      tone: 'default'
    };
  }

  getBrokerageLogoText(account: Account): string {
    return this.getBrokerageBrand(account).logoText;
  }

  getBrokerageLogoClass(account: Account): string {
    return `account-company-logo-${this.getBrokerageBrand(account).tone}`;
  }

  private getBrokerageInitials(value: string): string {
    const words = value.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return 'MW';
    }

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

  private getBrokerageFallbackKey(account: Account): string {
    return (account.brokerageId || account.name || account.id || 'brokerage').toLowerCase();
  }

  ngOnInit(): void {
    // SnapTrade redirects back here after the connect/trade flow. If we stashed the
    // account page the user started from, send them back there to see the result.
    const tradeReturn = sessionStorage.getItem('snaptradeTradeReturn');
    if (tradeReturn) {
      sessionStorage.removeItem('snaptradeTradeReturn');
      try {
        const { path } = JSON.parse(tradeReturn) as { path?: string };
        if (path && path.startsWith('/portfolio/')) {
          this.router.navigateByUrl(`${path}${path.includes('?') ? '&' : '?'}tradeConnectReturn=1`);
          return;
        }
      } catch (err) {
        console.error('Failed to parse SnapTrade trade-return state:', err, tradeReturn);
      }
    }
    this.loadPortfolio();
  }

  loadPortfolio(refresh = false): void {
    this.loading = true;
    this.error = null;

    // Backend handles user identification via authentication
    this.snapTradeService.getPortfolio(refresh).subscribe({
      next: (portfolio) => {
        this.portfolio = portfolio;
        this.accountGroups = this.buildAccountGroups(portfolio.accounts || []);
        this.loading = false;
        this.loadBalanceHistory();
        this.loadAccountIncomeStats(refresh);
      },
      error: (err) => {
        if (err.status === 404) {
          this.portfolio = null;
          this.accountGroups = [];
          this.expandedAccountGroupKeys = {};
          this.error = null;
          this.balanceHistory = [];
          this.futureProjections = [];
          this.showFuture = false;
          this.updateChartChange();
          this.loading = false;
          return;
        }
        this.error = err.error?.message || err.message || 'Failed to load portfolio. Please check your SnapTrade connection.';
        this.loading = false;
        console.error('Error loading portfolio:', err);
      }
    });
  }

  refreshPortfolio(): void {
    this.loadPortfolio(true);
  }

  toggleFuture(): void {
    this.showFuture = !this.showFuture;

    if (this.showFuture && this.futureProjections.length === 0 && !this.futureLoading) {
      this.loadFutureEstimate();
    }
  }

  loadFutureEstimate(refresh = false): void {
    if (!this.portfolio) {
      return;
    }

    this.futureLoading = true;
    this.futureError = null;

    this.loadIncomeStats(refresh, true);
  }

  private loadAccountIncomeStats(refresh = false): void {
    if (!this.portfolio) {
      return;
    }

    this.loadIncomeStats(refresh, false);
  }

  private loadIncomeStats(refresh = false, updateFutureLoading = false): void {
    forkJoin({
      recurring: this.snapTradeService.getRecurringInvestments(refresh),
      dividends: this.snapTradeService.getDividendIncome(refresh)
    }).subscribe({
      next: ({ recurring, dividends }) => {
        this.recurringInvestments = recurring || [];
        this.dividendIncome = dividends || null;
        this.updateFutureEstimate();
        if (updateFutureLoading) {
          this.futureLoading = false;
        }
      },
      error: (err) => {
        this.futureError = err.error?.message || err.message || 'Failed to load future estimate.';
        if (updateFutureLoading) {
          this.futureLoading = false;
        }
        console.error('Error loading future estimate:', err);
      }
    });
  }

  selectRange(range: ChartRange): void {
    if (range.label === this.selectedRange.label) {
      return;
    }

    this.selectedRange = range;
    this.applySelectedRange();
    this.updateChartChange();
  }

  // 'snapshots' = our saved daily snapshots (DB). 'brokerage' = live history from
  // SnapTrade Pro, computed in memory (not saved). Just changes what the chart reads.
  historySource: 'snapshots' | 'brokerage' = 'snapshots';
  historyMessage: string | null = null;

  setHistorySource(source: 'snapshots' | 'brokerage'): void {
    if (this.historySource === source) {
      return;
    }
    this.historySource = source;
    this.historyMessage = null;
    this.loadBalanceHistory();
  }

  loadBalanceHistory(): void {
    if (!this.portfolio || !this.portfolio.accounts || this.portfolio.accounts.length === 0) {
      this.balanceHistory = [];
      this.updateChartChange();
      return;
    }

    this.balanceHistoryLoading = true;
    const source$ = this.historySource === 'brokerage'
      ? this.snapTradeService.getPortfolioValueHistory()
      : this.snapTradeService.getPortfolioSnapshots().pipe(map(history => ({ history, message: null })));

    source$.subscribe({
      next: ({ history, message }) => {
        this.historyMessage = message;
        this.allBalanceHistory = history
          .map(snapshot => ({
            date: new Date(`${snapshot.snapshotDate}T00:00:00`),
            open: snapshot.totalBalance,
            high: snapshot.totalBalance,
            low: snapshot.totalBalance,
            close: snapshot.totalBalance,
            volume: 0
          }))
          .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
        this.applySelectedRange();
        this.updateChartChange();
        this.balanceHistoryLoading = false;
      },
      error: (err) => {
        console.error('Failed to load balance history:', err);
        this.historyMessage = this.historySource === 'brokerage'
          ? (err.error?.message || err.message || 'Could not load history from your brokerage.')
          : null;
        this.balanceHistory = [];
        this.allBalanceHistory = [];
        this.updateChartChange();
        this.balanceHistoryLoading = false;
      }
    });
  }

  private applySelectedRange(): void {
    if (!Number.isFinite(this.selectedRange.daysBack)) {
      this.balanceHistory = [...this.allBalanceHistory];
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.selectedRange.daysBack);
    this.balanceHistory = this.allBalanceHistory.filter(point => new Date(point.date) >= cutoff);
  }

  private updateFutureEstimate(): void {
    const currentValue = this.portfolio?.totalBalance || 0;
    const annualRecurringInvestment = this.recurringInvestments.reduce(
      (sum, investment) => sum + this.getRecurringYearlyAmount(investment),
      0
    );
    this.monthlyRecurringInvestment = annualRecurringInvestment / 12;
    this.currentAnnualDividendIncome = this.getAnnualDividendIncome();
    this.currentDividendYield = currentValue > 0 ? (this.currentAnnualDividendIncome / currentValue) * 100 : 0;

    const dividendYieldRate = this.currentDividendYield / 100;
    this.futureProjections = [
      { label: '1 Year', years: 1 },
      { label: '5 Years', years: 5 },
      { label: '10 Years', years: 10 },
      { label: '20 Years', years: 20 }
    ].map(({ label, years }) => {
      const value = currentValue + (annualRecurringInvestment * years);
      const annualIncome = dividendYieldRate > 0 ? value * dividendYieldRate : this.currentAnnualDividendIncome;

      return {
        label,
        years,
        value,
        annualIncome,
        monthlyIncome: annualIncome / 12
      };
    });
  }

  private getAnnualDividendIncome(): number {
    if (!this.dividendIncome || !this.dividendIncome.totals) {
      return 0;
    }

    return this.dividendIncome.totals.reduce((sum, total) => sum + (total.annualIncome || 0), 0);
  }

  private getRecurringYearlyAmount(investment: RecurringInvestment): number {
    const amount = investment.amount || 0;

    switch ((investment.frequency || '').toLowerCase()) {
      case 'daily':
        return amount * 252;
      case 'weekly':
        return amount * 52;
      case 'biweekly':
        return amount * 26;
      case 'quarterly':
        return amount * 4;
      case 'semiannual':
        return amount * 2;
      case 'annual':
      case 'yearly':
        return amount;
      case 'monthly':
      default:
        return amount * 12;
    }
  }

  viewAccount(account: Account): void {
    this.router.navigate(['/portfolio/accounts', account.id]);
  }

  getAccountTotalValue(account: Account): number {
    if (!account.holdings || account.holdings.length === 0) {
      return account.balance || 0;
    }
    return account.holdings.reduce((sum, holding) => sum + holding.totalValue, 0);
  }

  getAccountDisplayValue(account: Account): number {
    return account.balance ?? this.getAccountTotalValue(account);
  }

  toggleAccountGroup(groupKey: string): void {
    const shouldOpen = !this.isAccountGroupExpanded(groupKey);
    this.expandedAccountGroupKeys[groupKey] = shouldOpen;

    if (shouldOpen) {
      this.scrollAccountGroupHeaderToTop(groupKey);
    }
  }

  isAccountGroupExpanded(groupKey: string): boolean {
    return this.expandedAccountGroupKeys[groupKey] === true;
  }

  getAccountGroupElementId(groupKey: string): string {
    return `account-company-${groupKey.replace(/[^a-z0-9_-]+/gi, '-')}`;
  }

  getAccountGroupHeaderElementId(groupKey: string): string {
    return `${this.getAccountGroupElementId(groupKey)}-header`;
  }

  private scrollAccountGroupHeaderToTop(groupKey: string): void {
    window.setTimeout(() => {
      document.getElementById(this.getAccountGroupHeaderElementId(groupKey))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
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
    if (totalValue === 0 || totalValue === totalGainLoss) {
      return 0;
    }
    return (totalGainLoss / (totalValue - totalGainLoss)) * 100;
  }

  getPortfolioAllocation(account: Account): number {
    if (!this.portfolio || !this.portfolio.totalBalance) {
      return 0;
    }
    return (this.getAccountTotalValue(account) / this.portfolio.totalBalance) * 100;
  }

  getLargestHolding(account: Account): Holding | null {
    if (!account.holdings || account.holdings.length === 0) {
      return null;
    }
    return [...account.holdings].sort((a, b) => b.totalValue - a.totalValue)[0];
  }

  getAccountDividendIncome(account: Account): DividendIncomeAccount | null {
    if (!this.dividendIncome || !this.dividendIncome.accounts) {
      return null;
    }
    return this.dividendIncome.accounts.find(item => item.accountId === account.id) || null;
  }

  getAccountMonthlyRecurringBuys(account: Account): number {
    const annualRecurring = this.recurringInvestments
      .filter(investment => investment.accountId === account.id)
      .reduce((sum, investment) => sum + this.getRecurringYearlyAmount(investment), 0);
    return annualRecurring / 12;
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
        this.accountGroups = this.buildAccountGroups(this.portfolio?.accounts || []);
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

  private updateChartChange(): void {
    if (!this.balanceHistory || this.balanceHistory.length < 2) {
      this.chartChange = 0;
      this.chartChangePercent = 0;
      return;
    }

    const sorted = [...this.balanceHistory].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstClose = sorted[0].close;
    const lastClose = sorted[sorted.length - 1].close;

    this.chartChange = lastClose - firstClose;
    this.chartChangePercent = firstClose ? (this.chartChange / firstClose) * 100 : 0;
  }

  private buildAccountGroups(accounts: Account[]): AccountCompanyGroup[] {
    const groupsByKey = new Map<string, AccountCompanyGroup>();

    for (const account of accounts) {
      const brand = this.getBrokerageBrand(account);
      const group = groupsByKey.get(brand.key) || {
        ...brand,
        accounts: [],
        totalValue: 0,
        totalGainLoss: 0,
        holdingCount: 0
      };

      group.accounts.push(account);
      group.totalValue += this.getAccountDisplayValue(account);
      group.totalGainLoss += this.getAccountTotalGainLoss(account);
      group.holdingCount += account.holdings?.length || 0;
      groupsByKey.set(brand.key, group);
    }

    return [...groupsByKey.values()].sort((left, right) => left.name.localeCompare(right.name));
  }
}


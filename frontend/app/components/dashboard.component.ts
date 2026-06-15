import { Component, OnInit } from '@angular/core';
import { StockService } from '../services/stock.service';
import { StockQuote } from '../models/stock.model';
import { Observable, combineLatest, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SnapTradeService } from '../services/snaptrade.service';
import { AssetService } from '../services/asset.service';
import { LoanService } from '../services/loan.service';
import { CashflowService } from '../services/cashflow.service';
import { RealEstateService } from '../services/real-estate.service';
import { CashflowEntry } from '../models/cashflow.model';
import { Portfolio } from '../models/snaptrade.model';

interface InformationSnapshot {
  label: string;
  title: string;
  value: string;
  context: string;
  stats: Array<{ label: string; value: string; tone?: 'positive' | 'negative' }>;
  route: string;
  action: string;
  empty?: boolean;
}

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="dashboard">
      <section class="page-hero dashboard-hero">
        <div>
          <p class="page-kicker">Mork Wealth</p>
          <h1>Investing, simplified.</h1>
          <p class="dashboard-subtitle">A quick read on markets, accounts, cashflow, property, debt, and settings.</p>
        </div>
        <div class="hero-actions">
          <button class="btn btn-primary" routerLink="/search">Search Stocks</button>
          <button class="btn btn-secondary" routerLink="/portfolio">View Portfolio</button>
        </div>
      </section>

      <section class="card market-card" *ngIf="marketIndexes$ | async as indexes">
        <div class="card-header">
          <div>
            <span>Markets</span>
            <p>Broad market snapshots</p>
          </div>
          <span class="card-badge">{{ indexes.length }}</span>
        </div>
        <div class="grid grid-3" *ngIf="indexes.length > 0">
          <app-stock-card 
            *ngFor="let index of indexes" 
            [stock]="index"
            [showAddToWatchlist]="false">
          </app-stock-card>
        </div>
        <div *ngIf="indexes.length === 0" class="empty-state">
          <p>Market overview data is loading...</p>
        </div>
      </section>

      <section class="card page-snapshot-card">
        <ng-container *ngIf="informationSnapshots$ | async as snapshots">
          <div class="card-header">
            <div>
              <span>Financial Snapshots</span>
              <p>Live summaries from the rest of your workspace</p>
            </div>
            <span class="card-badge">{{ snapshots.length }}</span>
          </div>
          <div class="page-snapshot-grid">
            <article
              class="page-snapshot"
              *ngFor="let snapshot of snapshots"
              [class.empty]="snapshot.empty">
              <div class="snapshot-topline">
                <span class="snapshot-label">{{ snapshot.label }}</span>
                <a class="snapshot-link" [routerLink]="snapshot.route">{{ snapshot.action }}</a>
              </div>
              <h3>{{ snapshot.title }}</h3>
              <div class="snapshot-value" [class.muted]="snapshot.empty">{{ snapshot.value }}</div>
              <p>{{ snapshot.context }}</p>
              <div class="snapshot-stats">
                <div
                  class="snapshot-stat"
                  *ngFor="let stat of snapshot.stats"
                  [class.positive]="stat.tone === 'positive'"
                  [class.negative]="stat.tone === 'negative'">
                  <span>{{ stat.label }}</span>
                  <strong>{{ stat.value }}</strong>
                </div>
              </div>
            </article>
          </div>
        </ng-container>
      </section>

    </div>
  `,
  styles: [`
    .page-snapshot-card {
      overflow: hidden;
    }

    .page-snapshot-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--spacing-md);
    }

    .page-snapshot {
      min-height: 260px;
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      padding: var(--spacing-lg);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md, 8px);
      background:
        linear-gradient(135deg, rgba(20, 184, 166, 0.08), rgba(255, 255, 255, 0) 42%),
        rgba(255, 255, 255, 0.72);
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }

    .page-snapshot.empty {
      background:
        linear-gradient(135deg, rgba(148, 163, 184, 0.1), rgba(255, 255, 255, 0) 42%),
        rgba(255, 255, 255, 0.68);
    }

    .page-snapshot:hover,
    .page-snapshot:focus-visible {
      transform: translateY(-2px);
      border-color: rgba(20, 184, 166, 0.45);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      outline: none;
    }

    .snapshot-topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacing-sm);
    }

    .snapshot-label {
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .snapshot-link {
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .snapshot-link:hover,
    .snapshot-link:focus-visible {
      text-decoration: underline;
    }

    .page-snapshot h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--color-text-primary);
    }

    .snapshot-value {
      color: var(--color-text-primary);
      font-size: clamp(1.8rem, 3vw, 2.5rem);
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0;
    }

    .snapshot-value.muted {
      color: var(--color-text-secondary);
      font-size: 1.65rem;
    }

    .page-snapshot p {
      margin: 0;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .snapshot-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--spacing-sm);
      margin-top: auto;
      padding-top: var(--spacing-md);
      border-top: 1px solid var(--color-border);
    }

    .snapshot-stat {
      min-width: 0;
    }

    .snapshot-stat span {
      display: block;
      margin-bottom: 4px;
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
    }

    .snapshot-stat strong {
      display: block;
      color: var(--color-text-primary);
      font-size: 1rem;
      overflow-wrap: anywhere;
    }

    .snapshot-stat.positive strong {
      color: #15803d;
    }

    .snapshot-stat.negative strong {
      color: #dc2626;
    }

    @media (max-width: 1024px) {
      .page-snapshot-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .page-snapshot-grid {
        grid-template-columns: 1fr;
      }

      .page-snapshot {
        min-height: 0;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  marketIndexes$!: Observable<StockQuote[]>;
  informationSnapshots$!: Observable<InformationSnapshot[]>;

  // Market indexes to display: S&P 500 (SPY), QQQ (Nasdaq 100), Bitcoin (BTC/USD)
  private marketIndexSymbols = ['SPY', 'QQQ', 'BTC/USD'];
  private moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0
  });

  constructor(
    private stockService: StockService,
    private snapTradeService: SnapTradeService,
    private assetService: AssetService,
    private loanService: LoanService,
    private cashflowService: CashflowService,
    private realEstateService: RealEstateService
  ) {}

  ngOnInit(): void {
    this.marketIndexes$ = this.stockService.getMultipleQuotes(this.marketIndexSymbols);
    this.informationSnapshots$ = combineLatest({
      portfolio: this.snapTradeService.getPortfolio().pipe(catchError(() => of(null as Portfolio | null))),
      assets: this.assetService.getAssets(),
      loans: this.loanService.getLoans(),
      cashflowEntries: from(this.cashflowService.getEntries(this.currentMonth())).pipe(catchError(() => of([] as CashflowEntry[]))),
      properties: this.realEstateService.properties$
    }).pipe(
      map(({ portfolio, assets, loans, cashflowEntries, properties }) =>
        this.buildInformationSnapshots(portfolio, assets, loans, cashflowEntries, properties)
      )
    );
  }

  private buildInformationSnapshots(
    portfolio: Portfolio | null,
    assets: Array<{ value: number }>,
    loans: Array<{ principal: number; monthlyPayment: number; totalInterest: number }>,
    cashflowEntries: CashflowEntry[],
    properties: Array<{ monthlyCashFlow: number; capRate: number }>
  ): InformationSnapshot[] {
    const connectedPortfolioValue = portfolio?.totalBalance || 0;
    const manualAssetValue = assets.reduce((total, asset) => total + asset.value, 0);
    const debtPrincipal = loans.reduce((total, loan) => total + loan.principal, 0);
    const netWorth = connectedPortfolioValue + manualAssetValue - debtPrincipal;
    const totalIncome = cashflowEntries
      .filter(entry => entry.type === 'income')
      .reduce((total, entry) => total + entry.amount, 0);
    const totalExpenses = cashflowEntries
      .filter(entry => entry.type === 'expense')
      .reduce((total, entry) => total + entry.amount, 0);
    const monthlyBalance = totalIncome - totalExpenses;
    const totalMonthlyPayments = loans.reduce((total, loan) => total + loan.monthlyPayment, 0);
    const totalLoanInterest = loans.reduce((total, loan) => total + loan.totalInterest, 0);
    const propertyCashflow = properties.reduce((total, property) => total + property.monthlyCashFlow, 0);
    const averageCapRate = properties.length
      ? properties.reduce((total, property) => total + property.capRate, 0) / properties.length
      : 0;

    return [
      {
        label: 'Portfolio',
        title: 'Connected investments',
        value: portfolio ? this.formatMoney(connectedPortfolioValue) : 'Not connected',
        context: portfolio
          ? `${portfolio.accounts?.length || 0} brokerage ${portfolio.accounts?.length === 1 ? 'account' : 'accounts'} synced into your portfolio.`
          : 'Connect a brokerage account to bring balances and holdings into this dashboard.',
        route: '/portfolio',
        action: 'Open',
        empty: !portfolio,
        stats: [
          { label: 'Gain/Loss', value: portfolio ? this.formatMoney(portfolio.totalGainLoss, true) : '$0', tone: this.moneyTone(portfolio?.totalGainLoss || 0) },
          { label: 'Holdings', value: `${this.holdingCount(portfolio)} tracked` }
        ]
      },
      {
        label: 'Net Worth',
        title: 'Assets minus saved debt',
        value: this.formatMoney(netWorth),
        context: 'Connected portfolio value plus manual assets, less saved loan principal.',
        route: '/networth',
        action: 'Review',
        stats: [
          { label: 'Manual Assets', value: this.formatMoney(manualAssetValue) },
          { label: 'Debt', value: this.formatMoney(debtPrincipal), tone: debtPrincipal > 0 ? 'negative' : undefined }
        ]
      },
      {
        label: 'Cashflow',
        title: `${this.currentMonthLabel()} activity`,
        value: this.formatMoney(monthlyBalance, true),
        context: `${cashflowEntries.length} saved ${cashflowEntries.length === 1 ? 'entry' : 'entries'} this month.`,
        route: '/income-expenses',
        action: 'Open',
        empty: cashflowEntries.length === 0,
        stats: [
          { label: 'Income', value: this.formatMoney(totalIncome), tone: totalIncome > 0 ? 'positive' : undefined },
          { label: 'Expenses', value: this.formatMoney(totalExpenses), tone: totalExpenses > 0 ? 'negative' : undefined }
        ]
      },
      {
        label: 'Real Estate',
        title: 'Saved property analysis',
        value: properties.length ? `${properties.length} ${properties.length === 1 ? 'property' : 'properties'}` : 'No properties',
        context: properties.length
          ? 'Saved analyses summarize expected rent, cashflow, and return assumptions.'
          : 'Save a property analysis to see rental cashflow and cap rate here.',
        route: '/real-estate',
        action: 'Analyze',
        empty: properties.length === 0,
        stats: [
          { label: 'Monthly Cashflow', value: this.formatMoney(propertyCashflow, true), tone: this.moneyTone(propertyCashflow) },
          { label: 'Avg Cap Rate', value: `${averageCapRate.toFixed(2)}%` }
        ]
      },
      {
        label: 'Debt',
        title: 'Saved loan obligations',
        value: this.formatMoney(totalMonthlyPayments),
        context: `${loans.length} saved ${loans.length === 1 ? 'loan' : 'loans'} feeding debt and net worth calculations.`,
        route: '/networth/debt',
        action: 'Plan',
        empty: loans.length === 0,
        stats: [
          { label: 'Principal', value: this.formatMoney(debtPrincipal) },
          { label: 'Interest', value: this.formatMoney(totalLoanInterest), tone: totalLoanInterest > 0 ? 'negative' : undefined }
        ]
      },
      {
        label: 'Settings',
        title: 'Account controls',
        value: 'Ready',
        context: 'Sign-in and account preferences are available from settings.',
        route: '/settings',
        action: 'Manage',
        stats: [
          { label: 'Security', value: 'Sign-in' },
          { label: 'Profile', value: 'Account' }
        ]
      }
    ];
  }

  private formatMoney(value: number, showSign = false): string {
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${this.moneyFormatter.format(value || 0)}`;
  }

  private moneyTone(value: number): 'positive' | 'negative' | undefined {
    if (value > 0) {
      return 'positive';
    }
    if (value < 0) {
      return 'negative';
    }
    return undefined;
  }

  private holdingCount(portfolio: Portfolio | null): number {
    return portfolio?.accounts?.reduce((total, account) => total + (account.holdings?.length || 0), 0) || 0;
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private currentMonthLabel(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date());
  }
}


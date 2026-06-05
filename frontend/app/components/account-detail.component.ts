import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  Account,
  DividendIncomeAccount,
  DividendIncomeSymbol,
  DividendIncomeSummary,
  Holding,
  Portfolio,
  RecurringInvestment
} from '../models/snaptrade.model';
import { StockHistoricalData } from '../models/stock.model';
import { SnapTradeService } from '../services/snaptrade.service';

type ChartRange = {
  label: string;
  daysBack: number;
};

type FutureProjection = {
  label: string;
  years: number;
  value: number;
  annualIncome: number;
  monthlyIncome: number;
};

@Component({
  selector: 'app-account-detail',
  template: `
    <div class="portfolio account-detail">
      <button class="btn btn-secondary account-back-action" type="button" (click)="backToPortfolio()">
        &larr; Portfolio
      </button>

      <div class="card" *ngIf="loading && !account">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading account...</p>
        </div>
      </div>

      <div class="card" *ngIf="error && !loading">
        <div class="error-message">
          <h3>Account Unavailable</h3>
          <p>{{ error }}</p>
          <button class="btn btn-primary" type="button" (click)="loadAccount()">Retry</button>
        </div>
      </div>

      <div class="card" *ngIf="notFound && !loading && !error">
        <div class="empty-state">
          <h3>Account Not Found</h3>
          <p>This account is not available in your connected portfolio.</p>
          <button class="btn btn-primary" type="button" (click)="backToPortfolio()">Back to Portfolio</button>
        </div>
      </div>

      <ng-container *ngIf="account && portfolio && !loading">
        <section class="page-hero portfolio-hero account-detail-hero">
          <div>
            <p class="page-kicker">Account</p>
            <h1>{{ account.nickname || account.name }}</h1>
            <p class="page-subtitle">{{ account.accountNumber }} / {{ account.type }} / {{ account.currency }}</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary future-toggle-btn" type="button" [class.active]="showFuture" [attr.aria-pressed]="showFuture" (click)="toggleFuture()">
              Future
            </button>
            <button class="btn btn-secondary" type="button" (click)="startNicknameEdit(account)" [disabled]="savingAccountId === account.id || removingAccountId === account.id">
              Rename
            </button>
            <button class="btn btn-secondary danger-action" type="button" (click)="removeAccount(account)" [disabled]="savingAccountId === account.id || removingAccountId === account.id">
              {{ removingAccountId === account.id ? 'Removing...' : 'Remove' }}
            </button>
          </div>
        </section>

        <section class="card portfolio-future-card account-future-card" *ngIf="showFuture">
          <div class="future-card-header">
            <div>
              <span class="chart-eyebrow">Future Pace</span>
              <h2>{{ account.nickname || account.name }} Projection</h2>
            </div>
            <button class="account-icon-btn" type="button" title="Close future estimate" aria-label="Close future estimate" (click)="showFuture = false">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div class="future-loading" *ngIf="recurringLoading || dividendLoading">
            <div class="spinner"></div>
            <p>Estimating this account's future pace...</p>
          </div>

          <div class="compact-empty" *ngIf="!recurringLoading && !dividendLoading && (recurringError || dividendError)">
            <p>{{ recurringError || dividendError }}</p>
          </div>

          <ng-container *ngIf="!recurringLoading && !dividendLoading && !recurringError && !dividendError">
            <div class="future-summary-grid">
              <div class="future-summary-item">
                <label for="future-monthly-contribution">Monthly Contributions</label>
                <div class="future-money-input">
                  <span aria-hidden="true">$</span>
                  <input
                    id="future-monthly-contribution"
                    type="number"
                    min="0"
                    step="25"
                    inputmode="decimal"
                    [ngModel]="getFutureMonthlyContribution()"
                    (ngModelChange)="setFutureMonthlyContribution($event)"
                    aria-label="Monthly contributions for future projection" />
                </div>
              </div>
              <div class="future-summary-item">
                <label>Net Annual Income</label>
                <strong [class.positive]="getAccountNetAnnualIncome() >= 0" [class.negative]="getAccountNetAnnualIncome() < 0">
                  {{ formatDividendMoney(getAccountNetAnnualIncome(), account.currency) }}
                </strong>
              </div>
              <div class="future-summary-item">
                <label>{{ getFutureYieldLabel() }}</label>
                <strong>{{ getAccountDividendYield() | number:'1.2-2' }}%</strong>
              </div>
              <label class="future-reinvest-toggle">
                <input type="checkbox" [(ngModel)]="reinvestDividends" />
                <span>Reinvest dividends</span>
              </label>
            </div>

            <div class="future-projection-table-wrap" aria-label="Account future estimates">
              <table class="future-projection-table">
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Estimated Value</th>
                    <th scope="col">Monthly Income</th>
                    <th scope="col">Annual Income</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let projection of getFutureProjections()">
                    <td>{{ projection.label }}</td>
                    <td>{{ formatMoney(projection.value) }}</td>
                    <td>{{ formatMoney(projection.monthlyIncome) }}</td>
                    <td>{{ formatMoney(projection.annualIncome) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>
        </section>

        <section class="card" *ngIf="editingNicknameAccountId === account.id">
          <div class="account-preferences">
            <label [attr.for]="'nickname-detail-' + account.id">Nickname</label>
            <div class="account-preference-row">
              <input
                [id]="'nickname-detail-' + account.id"
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
        </section>

        <section class="card" *ngIf="!showFuture">
          <div class="card-header">
            <div>
              <span>All-time Stats</span>
              <p>Current holdings, cost basis, and account concentration</p>
            </div>
          </div>
          <div class="portfolio-summary account-detail-stats">
            <div class="summary-item">
              <label>Total Value</label>
              <div class="value">{{ formatMoney(account.balance) }}</div>
            </div>
            <div class="summary-item">
              <label>All-time Gain/Loss</label>
              <div class="value" [class.positive]="getAccountTotalGainLoss(account) >= 0" [class.negative]="getAccountTotalGainLoss(account) < 0">
                {{ formatMoney(getAccountTotalGainLoss(account), true) }}
                ({{ getAccountTotalGainLossPercent(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLossPercent(account) | number:'1.2-2' }}%)
              </div>
            </div>
            <div class="summary-item">
              <label>Allocation</label>
              <div class="value">{{ getPortfolioAllocation(account, portfolio) | number:'1.2-2' }}%</div>
            </div>
            <div class="summary-item">
              <label>Holdings</label>
              <div class="value compact-value">
                {{ account.holdings?.length || 0 }}
                <span *ngIf="getLargestHolding(account) as largest">({{ largest.symbol }})</span>
              </div>
            </div>
            <ng-container *ngIf="!dividendLoading && !dividendError && getAccountDividendIncome() as dividend">
              <div class="summary-item">
                <label>Net Monthly Income</label>
                <div class="value" [class.positive]="getAccountNetMonthlyIncome() >= 0" [class.negative]="getAccountNetMonthlyIncome() < 0">
                  {{ formatDividendMoney(getAccountNetMonthlyIncome(), dividend.currency) }}
                </div>
              </div>
            </ng-container>
            <ng-container *ngIf="!recurringLoading && !recurringError && filteredRecurringInvestments.length > 0">
              <div class="summary-item">
                <label>Monthly Recurring Buys</label>
                <div class="value">{{ formatMoney(getRecurringMonthlyTotal()) }}</div>
              </div>
            </ng-container>
          </div>
        </section>

        <section class="card account-balance-chart-card">
          <div class="stock-chart-section">
            <div class="chart-topline">
              <div>
                <span class="chart-eyebrow">{{ getActiveChartEyebrow() }}</span>
                <strong [class.positive]="getActiveChartChange() >= 0" [class.negative]="getActiveChartChange() < 0">
                  {{ getActiveChartChange() >= 0 ? '+' : '' }}{{ getActiveChartChange() | currency:'USD':'symbol':'1.2-2' }}
                  <span>({{ getActiveChartChangePercent() >= 0 ? '+' : '' }}{{ getActiveChartChangePercent() | number:'1.2-2' }}%)</span>
                </strong>
              </div>
              <span class="chart-range-label">{{ getActiveChartRangeLabel() }}</span>
            </div>
            <app-stock-chart
              [historicalData]="getActiveChartData()"
              [valueLabel]="showFuture ? 'Estimated Value' : 'Balance'"
              [ariaLabel]="showFuture ? 'Estimated future account value chart' : 'Account balance history chart'">
            </app-stock-chart>
            <div class="chart-range-tabs" *ngIf="!showFuture" role="tablist" aria-label="Account balance chart timeframe">
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
            <div class="chart-loading" *ngIf="!showFuture && balanceHistoryLoading">Updating chart...</div>
            <div class="chart-loading" *ngIf="showFuture && (recurringLoading || dividendLoading)">Estimating future value...</div>
            <div class="compact-empty" *ngIf="!showFuture && balanceHistoryError && !balanceHistoryLoading">
              <p>{{ balanceHistoryError }}</p>
            </div>
          </div>
        </section>

        <section class="card account-section-card dividend-income-card" *ngIf="dividendLoading || dividendError || getAccountDividendIncome()">
          <button
            class="account-section-toggle"
            type="button"
            [attr.aria-expanded]="isSectionExpanded('dividends')"
            aria-controls="account-dividend-section"
            (click)="toggleSection('dividends')">
            <div>
              <span>Estimated Dividend Income</span>
              <p>Account-level income after margin cost</p>
            </div>
            <div class="account-section-summary" *ngIf="!dividendLoading && !dividendError && getAccountDividendIncome() as dividend" aria-label="Dividend income summary">
              <div>
                <span>Net Annual</span>
                <strong [class.positive]="getAccountNetAnnualIncome() >= 0" [class.negative]="getAccountNetAnnualIncome() < 0">
                  {{ formatDividendMoney(getAccountNetAnnualIncome(), dividend.currency) }}
                </strong>
              </div>
              <div>
                <span>Net Monthly</span>
                <strong [class.positive]="getAccountNetMonthlyIncome() >= 0" [class.negative]="getAccountNetMonthlyIncome() < 0">
                  {{ formatDividendMoney(getAccountNetMonthlyIncome(), dividend.currency) }}
                </strong>
              </div>
              <div>
                <span>Margin Cost</span>
                <strong>{{ formatMoney(getAnnualMarginCost(account)) }}</strong>
              </div>
              <div>
                <span>Payments</span>
                <strong>{{ dividend.paymentCount }}</strong>
              </div>
              <div>
                <span>Last Paid</span>
                <strong>{{ formatDate(dividend.lastPaymentDate) }}</strong>
              </div>
            </div>
            <span class="expand-icon" [class.expanded]="isSectionExpanded('dividends')" aria-hidden="true">&rsaquo;</span>
          </button>
          <div id="account-dividend-section" class="account-section-body" *ngIf="isSectionExpanded('dividends')">
            <div class="loading-state compact" *ngIf="dividendLoading">
              <div class="spinner"></div>
              <p>Checking dividend activity...</p>
            </div>
            <div class="error-message compact" *ngIf="dividendError && !dividendLoading">
              <p>{{ dividendError }}</p>
            </div>
            <div class="table-wrapper dividend-income-table-wrapper" *ngIf="!dividendLoading && !dividendError && getAccountDividendSymbols().length > 0">
              <table class="table dividend-income-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Annual</th>
                    <th>Monthly</th>
                    <th>Shares</th>
                    <th>Avg / Share</th>
                  <th>Frequency</th>
                  <th>Last Paid</th>
                  <th>
                    <div class="table-header-actions">
                      <span>Actions</span>
                      <button
                        class="btn btn-secondary btn-sm recurring-reset-btn"
                        type="button"
                        title="Undo manual dividend changes"
                        aria-label="Undo manual dividend changes"
                        (click)="clearDividendManualChanges(); $event.stopPropagation()"
                        [disabled]="clearingDividendChanges">
                        {{ clearingDividendChanges ? 'Resetting...' : 'Reset' }}
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let symbol of getAccountDividendSymbols(); let i = index"
                  (click)="viewStock(symbol.symbol)"
                  [attr.aria-label]="'View details for ' + symbol.symbol">
                  <td><strong>{{ symbol.symbol }}</strong></td>
                  <ng-container *ngIf="dividendEditingIndex !== i; else dividendEditRow">
                    <td>{{ formatDividendMoney(symbol.annualIncome, symbol.currency) }}</td>
                    <td>{{ formatDividendMoney(symbol.monthlyIncome, symbol.currency) }}</td>
                    <td>{{ symbol.currentQuantity | number:'1.0-4' }}</td>
                    <td>{{ formatDividendMoney(symbol.averagePaymentPerShare, symbol.currency) }}</td>
                    <td>{{ titleCase(symbol.paymentFrequency) }}</td>
                    <td>{{ formatDate(symbol.lastPaymentDate) }}</td>
                    <td (click)="$event.stopPropagation()">
                      <div class="recurring-row-actions" aria-label="Dividend income actions">
                        <button
                          class="recurring-action-btn"
                          type="button"
                          title="Edit dividend frequency"
                          aria-label="Edit dividend frequency"
                          [disabled]="savingDividendIndex === i || removingDividendIndex === i"
                          (click)="startDividendEdit(i, symbol, $event)">
                          <span aria-hidden="true">&#9998;</span>
                        </button>
                        <button
                          class="recurring-action-btn danger"
                          type="button"
                          title="Remove dividend row"
                          aria-label="Remove dividend row"
                          [disabled]="savingDividendIndex === i || removingDividendIndex === i"
                          (click)="removeDividendSymbol(i, symbol, $event)">
                          <span aria-hidden="true">&times;</span>
                        </button>
                      </div>
                    </td>
                  </ng-container>
                  <ng-template #dividendEditRow>
                    <td colspan="7" (click)="$event.stopPropagation()">
                      <div class="dividend-edit-form">
                        <select [(ngModel)]="dividendEditDraft.paymentFrequency" aria-label="Dividend payment frequency">
                          <option *ngFor="let option of dividendFrequencyOptions" [value]="option.value">{{ option.label }}</option>
                        </select>
                        <button class="btn btn-primary btn-sm" type="button" (click)="saveDividendEdit(i, symbol, $event)" [disabled]="savingDividendIndex === i">
                          {{ savingDividendIndex === i ? 'Saving...' : 'Save' }}
                        </button>
                        <button class="btn btn-secondary btn-sm" type="button" (click)="cancelDividendEdit($event)" [disabled]="savingDividendIndex === i">Cancel</button>
                      </div>
                    </td>
                  </ng-template>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </section>

        <section class="card account-section-card recurring-investments-card">
          <div
            class="account-section-toggle recurring-card-header"
            role="button"
            tabindex="0"
            [attr.aria-expanded]="isSectionExpanded('recurring')"
            aria-controls="account-recurring-section"
            (click)="toggleSection('recurring')"
            (keydown.enter)="toggleSection('recurring')"
            (keydown.space)="toggleSection('recurring'); $event.preventDefault()">
            <div>
              <span>Recurring Buys</span>
              <p>Likely schedules from recent buy activity</p>
            </div>
            <div class="account-section-summary" *ngIf="!recurringLoading && !recurringError && filteredRecurringInvestments.length > 0" aria-label="Recurring buy totals">
              <div>
                <span>Orders</span>
                <strong>{{ filteredRecurringInvestments.length }}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{{ formatMoney(getRecurringOrderTotal()) }}</strong>
              </div>
              <div>
                <span>Monthly</span>
                <strong>{{ formatMoney(getRecurringMonthlyTotal()) }}</strong>
              </div>
              <div>
                <span>Yearly</span>
                <strong>{{ formatMoney(getRecurringYearlyTotal()) }}</strong>
              </div>
            </div>
            <span class="expand-icon" [class.expanded]="isSectionExpanded('recurring')" aria-hidden="true">&rsaquo;</span>
          </div>
          <div id="account-recurring-section" class="account-section-body" *ngIf="isSectionExpanded('recurring')">
            <div class="loading-state compact" *ngIf="recurringLoading">
              <div class="spinner"></div>
              <p>Checking recurring buys...</p>
            </div>
            <div class="error-message compact" *ngIf="recurringError && !recurringLoading">
              <p>{{ recurringError }}</p>
            </div>
            <div class="table-wrapper" *ngIf="!recurringLoading && filteredRecurringInvestments.length > 0">
              <table class="table recurring-investments-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Frequency</th>
                    <th>Amount</th>
                    <th>Monthly</th>
                    <th>Yearly</th>
                    <th>Allocation</th>
                    <th>Future Allocation</th>
                    <th>
                      <div class="table-header-actions">
                        <span>Actions</span>
                        <button
                          class="btn btn-secondary btn-sm recurring-reset-btn"
                          type="button"
                          title="Undo all manual recurring changes"
                          aria-label="Undo all manual recurring changes"
                          (click)="clearRecurringManualChanges(); $event.stopPropagation()"
                          [disabled]="clearingRecurringChanges">
                          {{ clearingRecurringChanges ? 'Resetting...' : 'Reset' }}
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let investment of filteredRecurringInvestments; let i = index">
                    <td><strong>{{ investment.symbol }}</strong></td>
                    <td *ngIf="recurringEditingIndex !== i">{{ titleCase(investment.frequency) }}</td>
                    <td *ngIf="recurringEditingIndex !== i">{{ formatMoney(investment.amount) }}</td>
                    <td *ngIf="recurringEditingIndex !== i">{{ formatMoney(getRecurringMonthlyAmount(investment)) }}</td>
                    <td *ngIf="recurringEditingIndex !== i">{{ formatMoney(getRecurringYearlyAmount(investment)) }}</td>
                    <td *ngIf="recurringEditingIndex !== i">{{ getRecurringCurrentAllocation(investment) | number:'1.2-2' }}%</td>
                    <td *ngIf="recurringEditingIndex !== i">{{ getRecurringFutureAllocation(investment) | number:'1.2-2' }}%</td>
                    <td *ngIf="recurringEditingIndex === i" colspan="6">
                      <div class="recurring-edit-form">
                        <select [(ngModel)]="recurringEditDraft.frequency" aria-label="Recurring buy frequency">
                          <option *ngFor="let option of recurringFrequencyOptions" [value]="option.value">{{ option.label }}</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          [(ngModel)]="recurringEditDraft.amount"
                          aria-label="Recurring buy amount"
                          (keydown.enter)="saveRecurringEdit(i, $event)"
                          (keydown.escape)="cancelRecurringEdit($event)" />
                        <button class="btn btn-primary btn-sm" type="button" (click)="saveRecurringEdit(i, $event)" [disabled]="savingRecurringIndex === i">
                          {{ savingRecurringIndex === i ? 'Saving...' : 'Save' }}
                        </button>
                        <button class="btn btn-secondary btn-sm" type="button" (click)="cancelRecurringEdit($event)" [disabled]="savingRecurringIndex === i">Cancel</button>
                      </div>
                    </td>
                    <td>
                      <div class="recurring-row-actions" aria-label="Recurring buy actions">
                        <button
                          class="recurring-action-btn"
                          type="button"
                          title="Edit recurring buy"
                          aria-label="Edit recurring buy"
                          [disabled]="savingRecurringIndex === i || removingRecurringIndex === i || recurringEditingIndex === i"
                          (click)="startRecurringEdit(i, investment)">
                          <span aria-hidden="true">&#9998;</span>
                        </button>
                        <button
                          class="recurring-action-btn danger"
                          type="button"
                          title="Remove recurring buy"
                          aria-label="Remove recurring buy"
                          [disabled]="savingRecurringIndex === i || removingRecurringIndex === i"
                          (click)="removeRecurringInvestment(i)">
                          <span aria-hidden="true">&times;</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="compact-empty" *ngIf="!recurringLoading && !recurringError && filteredRecurringInvestments.length === 0">
              <p>No recurring buys detected for this account yet.</p>
            </div>
          </div>
        </section>

        <section class="card account-section-card">
          <button
            class="account-section-toggle"
            type="button"
            [attr.aria-expanded]="isSectionExpanded('holdings')"
            aria-controls="account-holdings-section"
            (click)="toggleSection('holdings')">
            <div>
              <span>Holdings</span>
              <p>{{ account.holdings?.length || 0 }} current positions</p>
            </div>
            <div class="account-section-summary" *ngIf="account.holdings && account.holdings.length > 0" aria-label="Holdings summary">
              <div>
                <span>Positions</span>
                <strong>{{ account.holdings.length }}</strong>
              </div>
              <div>
                <span>Value</span>
                <strong>{{ formatMoney(getAccountTotalValue(account)) }}</strong>
              </div>
              <div>
                <span>Margin</span>
                <strong>{{ formatMoney(getMarginBalance(account)) }}</strong>
              </div>
              <div>
                <span>Gain/Loss</span>
                <strong [class.positive]="getAccountTotalGainLoss(account) >= 0" [class.negative]="getAccountTotalGainLoss(account) < 0">
                  {{ formatMoney(getAccountTotalGainLoss(account), true) }}
                </strong>
              </div>
              <div>
                <span>Gain/Loss %</span>
                <strong [class.positive]="getAccountTotalGainLossPercent(account) >= 0" [class.negative]="getAccountTotalGainLossPercent(account) < 0">
                  {{ getAccountTotalGainLossPercent(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLossPercent(account) | number:'1.2-2' }}%
                </strong>
              </div>
            </div>
            <span class="expand-icon" [class.expanded]="isSectionExpanded('holdings')" aria-hidden="true">&rsaquo;</span>
          </button>
          <div id="account-holdings-section" class="account-section-body" *ngIf="isSectionExpanded('holdings')">
            <div class="holdings-layout">
              <div class="holdings-main">
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
                    <th>Allocation</th>
                    <th>Gain/Loss</th>
                    <th>Gain/Loss %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    *ngFor="let holding of account.holdings"
                    (click)="viewStock(holding.symbol)"
                    [attr.aria-label]="'View details for ' + holding.symbol">
                    <td><strong>{{ holding.symbol }}</strong></td>
                    <td>{{ holding.quantity | number:'1.0-2' }}</td>
                    <td>{{ formatMoney(holding.averagePurchasePrice) }}</td>
                    <td>{{ formatMoney(holding.currentPrice) }}</td>
                    <td>{{ formatMoney(holding.totalValue) }}</td>
                    <td>{{ getHoldingAllocation(holding, account) | number:'1.2-2' }}%</td>
                    <td [class.positive]="holding.gainLoss >= 0" [class.negative]="holding.gainLoss < 0">
                      {{ formatMoney(holding.gainLoss, true) }}
                    </td>
                    <td [class.positive]="holding.gainLossPercent >= 0" [class.negative]="holding.gainLossPercent < 0">
                      {{ holding.gainLossPercent >= 0 ? '+' : '' }}{{ holding.gainLossPercent | number:'1.2-2' }}%
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="account-total">
                    <td colspan="4"><strong>Account Total</strong></td>
                    <td><strong>{{ formatMoney(getAccountTotalValue(account)) }}</strong></td>
                    <td><strong>{{ getAccountHoldingsAllocationTotal(account) | number:'1.2-2' }}%</strong></td>
                    <td [class.positive]="getAccountTotalGainLoss(account) >= 0" [class.negative]="getAccountTotalGainLoss(account) < 0">
                      <strong>{{ formatMoney(getAccountTotalGainLoss(account), true) }}</strong>
                    </td>
                    <td [class.positive]="getAccountTotalGainLossPercent(account) >= 0" [class.negative]="getAccountTotalGainLossPercent(account) < 0">
                      <strong>{{ getAccountTotalGainLossPercent(account) >= 0 ? '+' : '' }}{{ getAccountTotalGainLossPercent(account) | number:'1.2-2' }}%</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
                </div>
              </div>
              <aside class="margin-editor" (click)="$event.stopPropagation()" aria-label="Margin cost calculator">
                <div>
                  <span>Margin Used</span>
                  <strong>{{ formatMoney(getMarginBalance(account)) }}</strong>
                  <p>Estimated from holdings value minus account total value unless edited.</p>
                </div>
                <div class="margin-cost-grid">
                  <div>
                    <span>Interest Rate</span>
                    <strong>{{ getMarginInterestRate(account) | number:'1.2-2' }}%</strong>
                  </div>
                  <div>
                    <span>Monthly Cost</span>
                    <strong>{{ formatMoney(getMonthlyMarginCost(account)) }}</strong>
                  </div>
                  <div>
                    <span>Annual Cost</span>
                    <strong>{{ formatMoney(getAnnualMarginCost(account)) }}</strong>
                  </div>
                </div>
                <div class="margin-edit-form" *ngIf="editingMargin; else marginEditAction">
                  <label>
                    <span>Margin</span>
                    <input
                      class="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      [(ngModel)]="marginDraft"
                      aria-label="Margin balance"
                      (keydown.enter)="saveMargin(account)"
                      (keydown.escape)="cancelMarginEdit()" />
                  </label>
                  <label>
                    <span>APR %</span>
                    <input
                      class="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      [(ngModel)]="marginInterestRateDraft"
                      aria-label="Margin interest rate percent"
                      (keydown.enter)="saveMargin(account)"
                      (keydown.escape)="cancelMarginEdit()" />
                  </label>
                  <div class="margin-edit-actions">
                    <button class="btn btn-primary btn-sm" type="button" (click)="saveMargin(account)" [disabled]="savingMargin">
                      {{ savingMargin ? 'Saving...' : 'Save' }}
                    </button>
                    <button class="btn btn-secondary btn-sm" type="button" (click)="cancelMarginEdit()" [disabled]="savingMargin">Cancel</button>
                  </div>
                </div>
                <ng-template #marginEditAction>
                  <button class="btn btn-secondary btn-sm" type="button" (click)="startMarginEdit(account)" [disabled]="savingMargin">
                    Edit
                  </button>
                </ng-template>
              </aside>
            </div>
          </div>
        </section>
      </ng-container>
    </div>
  `
})
export class AccountDetailComponent implements OnInit {
  portfolio: Portfolio | null = null;
  account: Account | null = null;
  loading = false;
  error: string | null = null;
  notFound = false;
  recurringInvestments: RecurringInvestment[] = [];
  filteredRecurringInvestments: RecurringInvestment[] = [];
  recurringLoading = false;
  recurringError: string | null = null;
  dividendIncome: DividendIncomeSummary | null = null;
  dividendLoading = false;
  dividendError: string | null = null;
  dividendEditingIndex: number | null = null;
  savingDividendIndex: number | null = null;
  removingDividendIndex: number | null = null;
  clearingDividendChanges = false;
  dividendEditDraft = {
    paymentFrequency: 'annual'
  };
  balanceHistory: StockHistoricalData[] = [];
  balanceHistoryLoading = false;
  balanceHistoryError: string | null = null;
  chartChange = 0;
  chartChangePercent = 0;
  showFuture = false;
  reinvestDividends = true;
  futureMonthlyContributionOverride: number | null = null;
  chartRanges: ChartRange[] = [
    { label: '1W', daysBack: 7 },
    { label: '1M', daysBack: 30 },
    { label: '3M', daysBack: 90 },
    { label: '1Y', daysBack: 365 },
    { label: '5Y', daysBack: 365 * 5 },
    { label: 'All', daysBack: Number.POSITIVE_INFINITY }
  ];
  selectedRange = this.chartRanges[1];
  private balanceHistoryCache = new Map<string, StockHistoricalData[]>();
  private allBalanceHistory: StockHistoricalData[] = [];
  editingNicknameAccountId: string | null = null;
  savingAccountId: string | null = null;
  removingAccountId: string | null = null;
  nicknameDrafts: { [accountId: string]: string } = {};
  editingMargin = false;
  savingMargin = false;
  marginDraft = 0;
  marginInterestRateDraft = 0;
  recurringEditingIndex: number | null = null;
  recurringEditDraft = {
    amount: 0,
    frequency: 'monthly'
  };
  savingRecurringIndex: number | null = null;
  removingRecurringIndex: number | null = null;
  clearingRecurringChanges = false;
  expandedSections: { [section: string]: boolean } = {
    dividends: false,
    recurring: false,
    holdings: false
  };
  recurringFrequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semiannual', label: 'Semiannual' },
    { value: 'annual', label: 'Annual' }
  ];
  dividendFrequencyOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Biweekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semiannual', label: 'Semiannual' },
    { value: 'annual', label: 'Annual' }
  ];
  private readonly moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  constructor(
    private snapTradeService: SnapTradeService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAccount();
  }

  loadAccount(refresh = false): void {
    const accountId = this.route.snapshot.paramMap.get('accountId');
    this.loading = true;
    this.error = null;
    this.notFound = false;

    this.snapTradeService.getPortfolio(refresh).subscribe({
      next: (portfolio) => {
        this.portfolio = portfolio;
        this.account = portfolio.accounts.find(candidate => candidate.id === accountId) || null;
        this.notFound = !this.account;
        this.loading = false;
        if (this.account) {
          this.balanceHistoryCache.clear();
          this.loadBalanceHistory();
          this.loadRecurringInvestments(refresh);
          this.loadDividendIncome(refresh);
        }
      },
      error: (err) => {
        if (err.status === 404) {
          this.portfolio = null;
          this.account = null;
          this.notFound = true;
          this.loading = false;
          return;
        }
        this.error = err.error?.message || err.message || 'Failed to load account. Please check your SnapTrade connection.';
        this.loading = false;
        console.error('Error loading account:', err);
      }
    });
  }

  loadRecurringInvestments(refresh = false): void {
    this.recurringLoading = true;
    this.recurringError = null;

    this.snapTradeService.getRecurringInvestments(refresh).subscribe({
      next: (investments) => {
        this.recurringInvestments = investments;
        this.filteredRecurringInvestments = this.account
          ? investments.filter(investment => investment.accountId === this.account?.id)
          : [];
        this.recurringLoading = false;
      },
      error: (err) => {
        this.recurringInvestments = [];
        this.filteredRecurringInvestments = [];
        this.recurringError = err.error?.message || err.message || 'Failed to load recurring buys.';
        this.recurringLoading = false;
        console.error('Error loading recurring investments:', err);
      }
    });
  }

  loadDividendIncome(refresh = false): void {
    this.dividendLoading = true;
    this.dividendError = null;

    this.snapTradeService.getDividendIncome(refresh).subscribe({
      next: (income) => {
        this.dividendIncome = income;
        this.dividendLoading = false;
      },
      error: (err) => {
        this.dividendIncome = null;
        this.dividendError = err.error?.message || err.message || 'Failed to load dividend income.';
        this.dividendLoading = false;
        console.error('Error loading dividend income:', err);
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

  toggleFuture(): void {
    this.showFuture = !this.showFuture;
  }

  getActiveChartEyebrow(): string {
    return this.showFuture ? 'Estimated Future Value' : 'Balance History';
  }

  getActiveChartRangeLabel(): string {
    return this.showFuture ? '20Y' : this.selectedRange.label;
  }

  getActiveChartData(): StockHistoricalData[] {
    return this.showFuture ? this.getFutureChartData() : this.balanceHistory;
  }

  getActiveChartChange(): number {
    return this.getChartChangeStats(this.getActiveChartData()).change;
  }

  getActiveChartChangePercent(): number {
    return this.getChartChangeStats(this.getActiveChartData()).changePercent;
  }

  loadBalanceHistory(): void {
    if (!this.account) {
      this.balanceHistory = [];
      this.allBalanceHistory = [];
      this.balanceHistoryError = null;
      this.updateChartChange();
      return;
    }

    const cacheKey = this.account.id;
    const cached = this.balanceHistoryCache.get(cacheKey);
    if (cached) {
      this.allBalanceHistory = cached;
      this.applySelectedRange();
      this.updateChartChange();
      this.balanceHistoryLoading = false;
      return;
    }

    this.balanceHistoryLoading = true;
    this.balanceHistoryError = null;
    this.snapTradeService.getAccountSnapshots(this.account.id).subscribe({
      next: (snapshots) => {
        this.allBalanceHistory = (snapshots || [])
          .map(snapshot => ({
            date: new Date(`${snapshot.snapshotDate}T00:00:00`),
            open: snapshot.totalBalance,
            high: snapshot.totalBalance,
            low: snapshot.totalBalance,
            close: snapshot.totalBalance,
            volume: 0
          }))
          .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
        this.balanceHistoryCache.set(cacheKey, this.allBalanceHistory);
        this.applySelectedRange();
        this.balanceHistoryError = this.allBalanceHistory.length === 0
          ? 'No account balance snapshots yet. Refresh this account daily to build history.'
          : null;
        this.updateChartChange();
        this.balanceHistoryLoading = false;
      },
      error: (err) => {
        console.error('Failed to load account snapshots:', err);
        this.balanceHistory = [];
        this.allBalanceHistory = [];
        this.balanceHistoryError = err.error?.message || err.message || 'Failed to load account snapshots.';
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

  backToPortfolio(): void {
    this.router.navigate(['/portfolio']);
  }

  viewStock(symbol: string): void {
    this.router.navigate(['/stock', symbol]);
  }

  toggleSection(section: 'dividends' | 'recurring' | 'holdings'): void {
    const shouldOpen = !this.isSectionExpanded(section);
    this.expandedSections[section] = shouldOpen;
    if (shouldOpen) {
      this.centerSectionInView(section);
    }
  }

  isSectionExpanded(section: 'dividends' | 'recurring' | 'holdings'): boolean {
    return this.expandedSections[section] !== false;
  }

  private centerSectionInView(section: 'dividends' | 'recurring' | 'holdings'): void {
    const sectionElementIds = {
      dividends: 'account-dividend-section',
      recurring: 'account-recurring-section',
      holdings: 'account-holdings-section'
    };

    window.setTimeout(() => {
      document.getElementById(sectionElementIds[section])?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });
  }

  startNicknameEdit(account: Account): void {
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

  startMarginEdit(account: Account): void {
    this.editingMargin = true;
    this.marginDraft = this.getMarginBalance(account);
    this.marginInterestRateDraft = this.getMarginInterestRate(account);
  }

  cancelMarginEdit(): void {
    this.editingMargin = false;
  }

  saveMarginBalance(account: Account): void {
    this.saveMargin(account);
  }

  saveMargin(account: Account): void {
    const marginBalance = Math.max(0, Number(this.marginDraft) || 0);
    const marginInterestRate = Math.max(0, Number(this.marginInterestRateDraft) || 0);
    this.savingMargin = true;
    this.error = null;

    this.snapTradeService.updateAccountPreference(account.id, { marginBalance, marginInterestRate }).subscribe({
      next: (preference) => {
        account.marginBalance = preference.marginBalance ?? marginBalance;
        account.marginInterestRate = preference.marginInterestRate ?? marginInterestRate;
        this.editingMargin = false;
        this.savingMargin = false;
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to update margin balance.';
        this.savingMargin = false;
        console.error('Error updating margin balance:', err);
      }
    });
  }

  removeAccount(account: Account): void {
    const label = account.nickname || account.name || 'this account';
    if (!window.confirm(`Remove ${label} from this portfolio view?`)) {
      return;
    }

    this.removingAccountId = account.id;
    this.error = null;

    this.snapTradeService.hideAccount(account.id).subscribe({
      next: () => {
        this.removingAccountId = null;
        this.backToPortfolio();
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to remove account.';
        this.removingAccountId = null;
        console.error('Error removing account:', err);
      }
    });
  }

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

  getAccountTotalValue(account: Account): number {
    if (!account.holdings || account.holdings.length === 0) {
      return 0;
    }
    return account.holdings.reduce((sum, holding) => sum + holding.totalValue, 0);
  }

  getHoldingAllocation(holding: Holding, account: Account): number {
    const totalValue = this.getAccountTotalValue(account);
    if (totalValue <= 0) {
      return 0;
    }
    return (holding.totalValue / totalValue) * 100;
  }

  getAccountHoldingsAllocationTotal(account: Account): number {
    return this.getAccountTotalValue(account) > 0 ? 100 : 0;
  }

  getMarginBalance(account: Account): number {
    if (account.marginBalance !== null && account.marginBalance !== undefined) {
      return Math.max(0, account.marginBalance);
    }

    return Math.max(0, this.getAccountTotalValue(account) - (account.balance || 0));
  }

  getMarginInterestRate(account: Account): number {
    return Math.max(0, account.marginInterestRate || 0);
  }

  getAnnualMarginCost(account: Account): number {
    return this.getMarginBalance(account) * (this.getMarginInterestRate(account) / 100);
  }

  getMonthlyMarginCost(account: Account): number {
    return this.getAnnualMarginCost(account) / 12;
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

  getPortfolioAllocation(account: Account, portfolio: Portfolio): number {
    if (!portfolio.totalBalance) {
      return 0;
    }
    return ((account.balance || 0) / portfolio.totalBalance) * 100;
  }

  getLargestHolding(account: Account): Holding | null {
    if (!account.holdings || account.holdings.length === 0) {
      return null;
    }
    return [...account.holdings].sort((a, b) => b.totalValue - a.totalValue)[0];
  }

  getAccountDividendIncome(): DividendIncomeAccount | null {
    if (!this.account || !this.dividendIncome || !this.dividendIncome.accounts) {
      return null;
    }
    return this.dividendIncome.accounts.find(item => item.accountId === this.account?.id) || null;
  }

  getAccountAnnualDividendIncome(): number {
    return this.getAccountDividendIncome()?.annualIncome || 0;
  }

  getAccountNetAnnualIncome(): number {
    if (!this.account) {
      return this.getAccountAnnualDividendIncome();
    }

    return this.getAccountAnnualDividendIncome() - this.getAnnualMarginCost(this.account);
  }

  getAccountNetMonthlyIncome(): number {
    return this.getAccountNetAnnualIncome() / 12;
  }

  getAccountDividendYield(): number {
    const accountValue = this.getFutureStartingValue();
    return accountValue > 0 ? (this.getAccountNetAnnualIncome() / accountValue) * 100 : 0;
  }

  getFutureYieldLabel(): string {
    return this.isMarginAccount() ? 'Income Yield (Gross)' : 'Income Yield';
  }

  getFutureProjections(): FutureProjection[] {
    const currentValue = this.getFutureStartingValue();
    const annualRecurringInvestment = this.getFutureYearlyContribution();
    const netDividendYieldRate = this.getAccountDividendYield() / 100;

    return Array.from({ length: 20 }, (_, index) => {
      const years = index + 1;
      const value = this.getProjectedFutureValue(currentValue, annualRecurringInvestment, netDividendYieldRate, years);
      const annualIncome = netDividendYieldRate !== 0 ? value * netDividendYieldRate : this.getAccountNetAnnualIncome();

      return {
        label: `Year ${years}`,
        years,
        value,
        annualIncome,
        monthlyIncome: annualIncome / 12
      };
    });
  }

  getFutureMonthlyContribution(): number {
    return this.futureMonthlyContributionOverride ?? this.getRecurringMonthlyTotal();
  }

  setFutureMonthlyContribution(value: string | number | null): void {
    const parsed = Number(value);
    this.futureMonthlyContributionOverride = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private getFutureYearlyContribution(): number {
    return this.getFutureMonthlyContribution() * 12;
  }

  private getFutureChartData(): StockHistoricalData[] {
    const currentValue = this.getFutureStartingValue();
    const annualRecurringInvestment = this.getFutureYearlyContribution();
    const netDividendYieldRate = this.getAccountDividendYield() / 100;
    const today = new Date();

    return Array.from({ length: 241 }, (_, index) => {
      const years = index / 12;
      const date = new Date(today);
      date.setMonth(today.getMonth() + index);
      const value = this.getProjectedFutureValue(
        currentValue,
        annualRecurringInvestment,
        netDividendYieldRate,
        years
      );

      return {
        date,
        open: value,
        high: value,
        low: value,
        close: value,
        volume: 0
      };
    });
  }

  private getProjectedFutureValue(
    currentValue: number,
    annualRecurringInvestment: number,
    annualYieldRate: number,
    years: number
  ): number {
    return this.reinvestDividends
      ? this.getReinvestedFutureValue(currentValue, annualRecurringInvestment, annualYieldRate, years)
      : currentValue + (annualRecurringInvestment * years);
  }

  private getReinvestedFutureValue(
    currentValue: number,
    annualRecurringInvestment: number,
    annualYieldRate: number,
    years: number
  ): number {
    if (annualYieldRate === 0) {
      return currentValue + (annualRecurringInvestment * years);
    }

    if (annualYieldRate <= -1) {
      return Math.max(0, currentValue + (annualRecurringInvestment * years));
    }

    const growthFactor = Math.pow(1 + annualYieldRate, years);
    return (currentValue * growthFactor) + (annualRecurringInvestment * ((growthFactor - 1) / annualYieldRate));
  }

  private getFutureStartingValue(): number {
    if (!this.account) {
      return 0;
    }

    const balance = this.account.balance || 0;
    const holdingsValue = this.getAccountTotalValue(this.account);

    if (this.isMarginAccount()) {
      return Math.max(holdingsValue, balance);
    }

    return balance || holdingsValue;
  }

  private isMarginAccount(): boolean {
    return (this.account?.type || '').toLowerCase().includes('margin');
  }

  getAccountDividendSymbols(): DividendIncomeSymbol[] {
    if (!this.account || !this.dividendIncome || !this.dividendIncome.symbols) {
      return [];
    }
    return this.dividendIncome.symbols.filter(item => item.accountId === this.account?.id);
  }

  startDividendEdit(index: number, symbol: DividendIncomeSymbol, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.dividendEditingIndex = index;
    this.dividendEditDraft = {
      paymentFrequency: symbol.paymentFrequency || 'annual'
    };
  }

  saveDividendEdit(index: number, symbol: DividendIncomeSymbol, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const paymentFrequency = this.dividendEditDraft.paymentFrequency || symbol.paymentFrequency || 'annual';
    this.savingDividendIndex = index;
    this.dividendError = null;

    this.snapTradeService.updateDividendIncomePreference({
      symbol: symbol.symbol,
      currency: symbol.currency,
      paymentFrequency,
      hidden: false
    }).subscribe({
      next: () => {
        symbol.paymentFrequency = paymentFrequency;
        this.savingDividendIndex = null;
        this.cancelDividendEdit();
        this.loadDividendIncome(true);
      },
      error: (err) => {
        this.dividendError = err.error?.message || err.message || 'Failed to update dividend frequency.';
        this.savingDividendIndex = null;
        console.error('Error updating dividend frequency:', err);
      }
    });
  }

  cancelDividendEdit(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.dividendEditingIndex = null;
  }

  removeDividendSymbol(index: number, symbol: DividendIncomeSymbol, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.removingDividendIndex = index;
    this.dividendError = null;

    this.snapTradeService.hideDividendIncomePreference({
      symbol: symbol.symbol,
      currency: symbol.currency,
      paymentFrequency: symbol.paymentFrequency || 'annual'
    }).subscribe({
      next: () => {
        this.removingDividendIndex = null;
        this.cancelDividendEdit();
        this.loadDividendIncome(true);
      },
      error: (err) => {
        this.dividendError = err.error?.message || err.message || 'Failed to remove dividend row.';
        this.removingDividendIndex = null;
        console.error('Error removing dividend row:', err);
      }
    });
  }

  clearDividendManualChanges(): void {
    this.clearingDividendChanges = true;
    this.dividendError = null;

    this.snapTradeService.clearDividendIncomePreferences([]).subscribe({
      next: () => {
        this.clearingDividendChanges = false;
        this.cancelDividendEdit();
        this.loadDividendIncome(true);
      },
      error: (err) => {
        this.dividendError = err.error?.message || err.message || 'Failed to undo manual dividend changes.';
        this.clearingDividendChanges = false;
        console.error('Error clearing dividend changes:', err);
      }
    });
  }

  startRecurringEdit(index: number, investment: RecurringInvestment): void {
    this.recurringEditingIndex = index;
    this.recurringEditDraft = {
      amount: investment.amount || 0,
      frequency: investment.frequency || 'monthly'
    };
  }

  saveRecurringEdit(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const investment = this.filteredRecurringInvestments[index];
    if (!investment) {
      this.cancelRecurringEdit();
      return;
    }

    const amount = Math.max(0, Number(this.recurringEditDraft.amount) || 0);
    const frequency = this.recurringEditDraft.frequency || investment.frequency;
    this.savingRecurringIndex = index;
    this.recurringError = null;

    this.snapTradeService.updateRecurringInvestmentPreference({
      accountId: investment.accountId,
      symbol: investment.symbol,
      currency: investment.currency,
      amount,
      frequency,
      hidden: false
    }).subscribe({
      next: (preference) => {
        investment.amount = preference.amount ?? amount;
        investment.frequency = preference.frequency || frequency;
        investment.currency = preference.currency || investment.currency;
        this.savingRecurringIndex = null;
        this.cancelRecurringEdit();
      },
      error: (err) => {
        this.recurringError = err.error?.message || err.message || 'Failed to update recurring buy.';
        this.savingRecurringIndex = null;
        console.error('Error updating recurring buy:', err);
      }
    });
  }

  cancelRecurringEdit(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.recurringEditingIndex = null;
  }

  removeRecurringInvestment(index: number): void {
    const investment = this.filteredRecurringInvestments[index];
    if (!investment) {
      return;
    }
    this.removingRecurringIndex = index;
    this.recurringError = null;

    this.snapTradeService.hideRecurringInvestmentPreference({
      accountId: investment.accountId,
      symbol: investment.symbol,
      currency: investment.currency
    }).subscribe({
      next: () => {
        this.filteredRecurringInvestments.splice(index, 1);
        this.removingRecurringIndex = null;
        if (this.recurringEditingIndex === index) {
          this.cancelRecurringEdit();
        }
      },
      error: (err) => {
        this.recurringError = err.error?.message || err.message || 'Failed to remove recurring buy.';
        this.removingRecurringIndex = null;
        console.error('Error removing recurring buy:', err);
      }
    });
  }

  clearRecurringManualChanges(): void {
    if (!this.account) {
      return;
    }

    this.clearingRecurringChanges = true;
    this.recurringError = null;

    this.snapTradeService.clearRecurringInvestmentPreferences(this.account.id).subscribe({
      next: () => {
        this.clearingRecurringChanges = false;
        this.recurringEditingIndex = null;
        this.loadRecurringInvestments(true);
      },
      error: (err) => {
        this.recurringError = err.error?.message || err.message || 'Failed to undo manual recurring buy changes.';
        this.clearingRecurringChanges = false;
        console.error('Error clearing recurring buy changes:', err);
      }
    });
  }

  getRecurringOrderTotal(): number {
    return this.filteredRecurringInvestments.reduce((sum, investment) => sum + (investment.amount || 0), 0);
  }

  getRecurringDailyTotal(): number {
    return this.getRecurringYearlyTotal() / 252;
  }

  getRecurringMonthlyTotal(): number {
    return this.getRecurringYearlyTotal() / 12;
  }

  getRecurringMonthlyAmount(investment: RecurringInvestment): number {
    return this.getRecurringYearlyAmount(investment) / 12;
  }

  getRecurringCurrentAllocation(investment: RecurringInvestment): number {
    if (!this.account || !this.account.holdings || this.account.holdings.length === 0) {
      return 0;
    }

    const totalValue = this.getAccountTotalValue(this.account);
    if (totalValue <= 0) {
      return 0;
    }

    const symbol = (investment.symbol || '').toUpperCase();
    const holdingValue = this.account.holdings
      .filter(holding => (holding.symbol || '').toUpperCase() === symbol)
      .reduce((sum, holding) => sum + holding.totalValue, 0);

    return (holdingValue / totalValue) * 100;
  }

  getRecurringFutureAllocation(investment: RecurringInvestment): number {
    const yearlyTotal = this.getRecurringYearlyTotal();
    if (yearlyTotal <= 0) {
      return 0;
    }
    return (this.getRecurringYearlyAmount(investment) / yearlyTotal) * 100;
  }

  getRecurringYearlyTotal(): number {
    return this.filteredRecurringInvestments.reduce(
      (sum, investment) => sum + this.getRecurringYearlyAmount(investment),
      0
    );
  }

  getRecurringYearlyAmount(investment: RecurringInvestment): number {
    const amount = investment.amount || 0;
    switch ((investment.frequency || '').toLowerCase()) {
      case 'daily':
        return amount * 252;
      case 'weekly':
        return amount * 52;
      case 'biweekly':
        return amount * 26;
      case 'monthly':
        return amount * 12;
      case 'quarterly':
        return amount * 4;
      case 'semiannual':
        return amount * 2;
      case 'annual':
      case 'yearly':
        return amount;
      default:
        return amount;
    }
  }

  private updateChartChange(): void {
    const stats = this.getChartChangeStats(this.balanceHistory);
    this.chartChange = stats.change;
    this.chartChangePercent = stats.changePercent;
  }

  private getChartChangeStats(data: StockHistoricalData[]): { change: number; changePercent: number } {
    if (!data || data.length < 2) {
      return { change: 0, changePercent: 0 };
    }

    const sorted = [...data].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstClose = sorted[0].close;
    const lastClose = sorted[sorted.length - 1].close;
    const change = lastClose - firstClose;

    return {
      change,
      changePercent: firstClose ? (change / firstClose) * 100 : 0
    };
  }
}

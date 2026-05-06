import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  CashflowEntry,
  CashflowType,
  PlaidAccount,
  PlaidSyncSummary
} from '../models/cashflow.model';
import { AuthService } from '../services/auth.service';
import { CashflowService } from '../services/cashflow.service';
import { PlaidService } from '../services/plaid.service';

declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        onSuccess: (publicToken: string, metadata: any) => void;
        onExit?: (error: any) => void;
      }): { open: () => void };
    };
  }
}

interface CategoryTotal {
  category: string;
  total: number;
  percent: number;
}

interface InstitutionAccountGroup {
  itemId: string;
  name: string;
  accounts: PlaidAccount[];
  totalBalance: number;
}

@Component({
  selector: 'app-income-expenses',
  template: `
    <div class="income-expenses">
      <section class="page-hero income-expenses-hero">
        <div>
          <p class="page-kicker">Cashflow</p>
          <h1>Income & Expenses</h1>
          <p class="page-subtitle">Track money in, spending out, and Plaid-imported card and bank activity.</p>
        </div>
        <div class="hero-actions">
          <input
            class="month-input"
            type="month"
            [ngModel]="selectedMonth"
            (ngModelChange)="onMonthChange($event)"
            aria-label="Cashflow month"
          />
          <button type="button" class="btn btn-secondary" (click)="syncPlaid(false)" [disabled]="isSyncing || isLoading">
            {{ isSyncing ? 'Syncing...' : 'Sync' }}
          </button>
          <button type="button" class="btn btn-primary" (click)="connectPlaid()" [disabled]="isConnecting">
            {{ isConnecting ? 'Connecting...' : 'Connect Plaid' }}
          </button>
        </div>
      </section>

      <div class="error-message" *ngIf="errorMessage">{{ errorMessage }}</div>
      <div class="success-message" *ngIf="successMessage">{{ successMessage }}</div>

      <section class="plaid-institution-list" *ngIf="institutionAccountGroups.length > 0" aria-label="Connected Plaid institutions">
        <article class="total-item plaid-institution-card" *ngFor="let group of institutionAccountGroups">
          <div class="institution-card-header">
            <div>
              <span class="total-label">{{ group.name }}</span>
              <span class="institution-account-count">
                {{ group.accounts.length }} {{ group.accounts.length === 1 ? 'account' : 'accounts' }}
              </span>
            </div>
            <div class="institution-header-actions">
              <span class="total-value">{{ formatMoney(group.totalBalance) }}</span>
              <button
                type="button"
                class="institution-disconnect-btn"
                title="Disconnect institution from Plaid"
                aria-label="Disconnect institution from Plaid"
                (click)="disconnectPlaidInstitution(group)"
                [disabled]="removingConnectionId === group.itemId">
                Disconnect
              </button>
            </div>
          </div>

          <div class="institution-account-list">
            <div class="institution-account-row" *ngFor="let account of group.accounts">
              <div>
                <span class="account-name">{{ account.name }}<span *ngIf="account.mask"> ...{{ account.mask }}</span></span>
                <span class="account-meta">{{ account.subtype || account.type }}</span>
              </div>
              <div class="institution-account-actions">
                <span class="account-balance">{{ formatMoney(account.currentBalance || 0) }}</span>
                <button
                  type="button"
                  class="account-hide-btn"
                  title="Hide this account locally"
                  aria-label="Hide this account locally"
                  (click)="hidePlaidAccount(account)"
                  [disabled]="hidingAccountId === account.id">
                  Hide
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="card cashflow-summary-card" aria-live="polite">
        <div class="card-header">
          <div>
            <span>Monthly Snapshot</span>
            <p>{{ entries.length }} saved {{ entries.length === 1 ? 'entry' : 'entries' }}</p>
          </div>
          <span class="card-badge">{{ selectedMonth }}</span>
        </div>
        <div class="cashflow-summary-grid">
          <div class="total-item">
            <span class="total-label">Income</span>
            <span class="total-value positive">{{ formatMoney(totalIncome) }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Expenses</span>
            <span class="total-value negative">{{ formatMoney(totalExpenses) }}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Remaining</span>
            <span class="total-value" [class.positive]="monthlyBalance >= 0" [class.negative]="monthlyBalance < 0">
              {{ formatMoney(monthlyBalance) }}
            </span>
          </div>
          <div class="total-item">
            <span class="total-label">Savings Rate</span>
            <span class="total-value">{{ savingsRate | number:'1.0-1' }}%</span>
          </div>
        </div>
      </section>

      <div class="cashflow-workspace">
        <section class="card cashflow-form-card">
          <div class="card-header">
            <div>
              <span>Add Manual Entry</span>
              <p>Plaid imports save automatically after sync</p>
            </div>
          </div>

          <form [formGroup]="entryForm" (ngSubmit)="addEntry()">
            <div class="cashflow-type-toggle" role="group" aria-label="Entry type">
              <button type="button" class="cashflow-type-button" [class.active]="entryForm.value.type === 'income'" (click)="setType('income')">
                Income
              </button>
              <button type="button" class="cashflow-type-button" [class.active]="entryForm.value.type === 'expense'" (click)="setType('expense')">
                Expense
              </button>
            </div>

            <div class="form-group">
              <label for="cashflowName">Name</label>
              <input id="cashflowName" type="text" class="form-input" formControlName="name" placeholder="e.g., Paycheck, Rent, Utilities" />
              <div class="form-error" *ngIf="entryForm.get('name')?.hasError('required') && entryForm.get('name')?.touched">Name is required</div>
            </div>

            <div class="grid grid-2">
              <div class="form-group">
                <label for="cashflowCategory">Category</label>
                <input id="cashflowCategory" type="text" class="form-input" formControlName="category" placeholder="e.g., Housing" />
                <div class="form-error" *ngIf="entryForm.get('category')?.hasError('required') && entryForm.get('category')?.touched">Category is required</div>
              </div>

              <div class="form-group">
                <label for="cashflowAmount">Amount ($)</label>
                <input id="cashflowAmount" type="number" class="form-input" formControlName="amount" min="0.01" step="0.01" placeholder="0.00" />
                <div class="form-error" *ngIf="entryForm.get('amount')?.hasError('required') && entryForm.get('amount')?.touched">Amount is required</div>
                <div class="form-error" *ngIf="entryForm.get('amount')?.hasError('min')">Amount must be greater than 0</div>
              </div>
            </div>

            <div class="form-group">
              <label for="cashflowDate">Date</label>
              <input id="cashflowDate" type="date" class="form-input" formControlName="date" />
            </div>

            <button type="submit" class="btn btn-primary" [disabled]="entryForm.invalid || isSaving">
              {{ isSaving ? 'Saving...' : 'Add Entry' }}
            </button>
          </form>
        </section>

        <section class="card category-card">
          <div class="card-header">
            <div>
              <span>Expense Mix</span>
              <p>Largest monthly categories</p>
            </div>
          </div>
          <div class="category-breakdown" *ngIf="expenseCategories.length > 0; else noExpenses">
            <div class="category-row" *ngFor="let item of expenseCategories">
              <div class="category-row-top">
                <strong>{{ item.category }}</strong>
                <span>{{ formatMoney(item.total) }}</span>
              </div>
              <div class="category-meter" aria-hidden="true">
                <span [style.width.%]="item.percent"></span>
              </div>
            </div>
          </div>
          <ng-template #noExpenses>
            <div class="empty-state compact-empty">
              <p>No expenses added yet.</p>
            </div>
          </ng-template>
        </section>
      </div>

      <section class="card entries-card">
        <div class="card-header">
          <div>
            <span>Entries</span>
            <p>Manual entries and Plaid imports for {{ selectedMonth }}</p>
          </div>
        </div>

        <div class="loading-state compact" *ngIf="isLoading">
          <div class="spinner"></div>
          <p>Loading cashflow...</p>
        </div>

        <div class="table-wrapper" *ngIf="!isLoading && entries.length > 0; else emptyEntries">
          <table class="table cashflow-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Source</th>
                <th>Category</th>
                <th>Amount</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of entries">
                <td>{{ formatDate(entry.date) }}</td>
                <td><strong>{{ entry.merchantName || entry.name }}</strong></td>
                <td>
                  <span class="cashflow-pill" [class.income]="entry.source === 'plaid'" [class.expense]="entry.source === 'manual'">
                    {{ entry.source }}
                  </span>
                </td>
                <td>{{ entry.category }}</td>
                <td [class.positive]="entry.type === 'income'" [class.negative]="entry.type === 'expense'">
                  {{ entry.type === 'expense' ? '-' : '' }}{{ formatMoney(entry.amount) }}
                </td>
                <td>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="deleteEntry(entry.id)" [disabled]="deletingEntryId === entry.id">
                    {{ deletingEntryId === entry.id ? 'Deleting...' : 'Delete' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #emptyEntries>
          <div class="empty-state" *ngIf="!isLoading">
            <h3>No cashflow entries yet</h3>
            <p>Connect Plaid or add a manual entry to see your monthly snapshot.</p>
          </div>
        </ng-template>
      </section>
    </div>
  `,
})
export class IncomeExpensesComponent implements OnInit, OnDestroy {
  entries: CashflowEntry[] = [];
  accounts: PlaidAccount[] = [];
  selectedMonth = this.currentMonth();
  entryForm: FormGroup;
  isLoading = false;
  isSaving = false;
  isConnecting = false;
  isSyncing = false;
  deletingEntryId = '';
  removingConnectionId = '';
  hidingAccountId = '';
  errorMessage = '';
  successMessage = '';
  private authSubscription?: Subscription;
  private readonly moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private cashflowService: CashflowService,
    private plaidService: PlaidService
  ) {
    this.entryForm = this.fb.group({
      type: ['expense' as CashflowType, [Validators.required]],
      name: ['', [Validators.required]],
      category: ['', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [this.today(), [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadPage(true);
      } else {
        this.entries = [];
        this.accounts = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  get totalIncome(): number {
    return this.entries.filter(entry => entry.type === 'income').reduce((total, entry) => total + entry.amount, 0);
  }

  get totalExpenses(): number {
    return this.entries.filter(entry => entry.type === 'expense').reduce((total, entry) => total + entry.amount, 0);
  }

  get monthlyBalance(): number {
    return this.totalIncome - this.totalExpenses;
  }

  get savingsRate(): number {
    return this.totalIncome > 0 ? (this.monthlyBalance / this.totalIncome) * 100 : 0;
  }

  get expenseCategories(): CategoryTotal[] {
    const totals = this.entries
      .filter(entry => entry.type === 'expense')
      .reduce((groups, entry) => {
        groups[entry.category] = (groups[entry.category] || 0) + entry.amount;
        return groups;
      }, {} as Record<string, number>);
    return Object.entries(totals)
      .map(([category, total]) => ({
        category,
        total,
        percent: this.totalExpenses > 0 ? (total / this.totalExpenses) * 100 : 0
      }))
      .sort((first, second) => second.total - first.total);
  }

  get institutionAccountGroups(): InstitutionAccountGroup[] {
    const groups = this.accounts.reduce((accumulator, account) => {
      const itemId = account.itemId || account.id;
      const name = account.institutionName || 'Plaid';
      if (!accumulator[itemId]) {
        accumulator[itemId] = {
          itemId,
          name,
          accounts: [],
          totalBalance: 0
        };
      }
      accumulator[itemId].accounts.push(account);
      accumulator[itemId].totalBalance += account.currentBalance || 0;
      return accumulator;
    }, {} as Record<string, InstitutionAccountGroup>);

    return Object.values(groups)
      .map(group => ({
        ...group,
        accounts: group.accounts.sort((first, second) => this.comparePlaidAccounts(first, second))
      }))
      .sort((first, second) => {
        const rankDifference = this.accountGroupRank(first) - this.accountGroupRank(second);
        return rankDifference || first.name.localeCompare(second.name);
      });
  }

  async loadPage(autoSync = false): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      if (autoSync) {
        await this.syncPlaid(true);
      }
      await Promise.all([this.loadEntries(), this.loadAccounts()]);
    } catch (error: any) {
      this.errorMessage = error?.error?.message || error?.message || 'Unable to load cashflow.';
    } finally {
      this.isLoading = false;
    }
  }

  async loadEntries(): Promise<void> {
    this.entries = await this.cashflowService.getEntries(this.selectedMonth);
  }

  async loadAccounts(): Promise<void> {
    this.accounts = await this.plaidService.getAccounts();
  }

  async connectPlaid(): Promise<void> {
    if (!window.Plaid) {
      this.errorMessage = 'Plaid Link did not load. Check your connection and try again.';
      return;
    }
    this.isConnecting = true;
    this.errorMessage = '';
    try {
      const token = await this.plaidService.createLinkToken();
      window.Plaid.create({
        token,
        onSuccess: async (publicToken: string, metadata: any) => {
          try {
            await this.plaidService.exchangePublicToken({
              publicToken,
              institutionId: metadata?.institution?.institution_id || null,
              institutionName: metadata?.institution?.name || null
            });
            await Promise.all([this.loadEntries(), this.loadAccounts()]);
            this.successMessage = 'Plaid account connected and imported.';
          } catch (error: any) {
            this.errorMessage = error?.error?.message || error?.message || 'Unable to finish Plaid connection.';
          }
        },
        onExit: (error: any) => {
          if (error) {
            this.errorMessage = error.display_message || error.error_message || 'Plaid Link was closed before connecting.';
          }
        }
      }).open();
    } catch (error: any) {
      this.errorMessage = error?.error?.message || error?.message || 'Unable to start Plaid Link.';
    } finally {
      this.isConnecting = false;
    }
  }

  async syncPlaid(auto = false): Promise<void> {
    this.isSyncing = true;
    this.errorMessage = '';
    try {
      const summary = await this.plaidService.sync(auto);
      if (!auto || summary.itemsSynced > 0) {
        this.successMessage = this.syncMessage(summary);
      }
      await Promise.all([this.loadEntries(), this.loadAccounts()]);
    } catch (error: any) {
      if (!auto) {
        this.errorMessage = error?.error?.message || error?.message || 'Unable to sync Plaid.';
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async addEntry(): Promise<void> {
    if (this.entryForm.invalid) {
      this.entryForm.markAllAsTouched();
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    try {
      const { type, name, category, amount, date } = this.entryForm.value;
      await this.cashflowService.createEntry({
        type,
        name: name.trim(),
        category: category.trim(),
        amount: Number(amount),
        date
      });
      this.clearDraft();
      await this.loadEntries();
    } catch (error: any) {
      this.errorMessage = error?.error?.detail || error?.message || 'Unable to save entry.';
    } finally {
      this.isSaving = false;
    }
  }

  async deleteEntry(id: string): Promise<void> {
    this.deletingEntryId = id;
    this.errorMessage = '';
    try {
      await this.cashflowService.deleteEntry(id);
      await this.loadEntries();
    } catch (error: any) {
      this.errorMessage = error?.error?.detail || error?.message || 'Unable to delete entry.';
    } finally {
      this.deletingEntryId = '';
    }
  }

  async disconnectPlaidInstitution(group: InstitutionAccountGroup): Promise<void> {
    const anchorAccount = group.accounts[0];
    const label = group.name || 'this institution';
    if (!anchorAccount) {
      return;
    }
    if (!window.confirm(`Disconnect ${label} from Plaid? This ends the Plaid connection and hides imported entries from all ${group.accounts.length} linked ${group.accounts.length === 1 ? 'account' : 'accounts'} at this institution.`)) {
      return;
    }
    this.removingConnectionId = group.itemId;
    this.errorMessage = '';
    try {
      await this.plaidService.removeAccount(anchorAccount.id);
      await Promise.all([this.loadAccounts(), this.loadEntries()]);
      this.successMessage = `${label} disconnected from Plaid.`;
    } catch (error: any) {
      this.errorMessage = error?.error?.detail || error?.error?.message || error?.message || 'Unable to disconnect Plaid institution.';
    } finally {
      this.removingConnectionId = '';
    }
  }

  async hidePlaidAccount(account: PlaidAccount): Promise<void> {
    const label = account.mask ? `${account.name} ...${account.mask}` : account.name;
    if (!window.confirm(`Hide ${label}? This only removes the account and its imported entries from this app. The Plaid institution connection stays active.`)) {
      return;
    }
    this.hidingAccountId = account.id;
    this.errorMessage = '';
    try {
      await this.plaidService.hideAccount(account.id);
      await Promise.all([this.loadAccounts(), this.loadEntries()]);
      this.successMessage = `${label} hidden from cashflow.`;
    } catch (error: any) {
      this.errorMessage = error?.error?.detail || error?.error?.message || error?.message || 'Unable to hide Plaid account.';
    } finally {
      this.hidingAccountId = '';
    }
  }

  onMonthChange(month: string): void {
    this.selectedMonth = month;
    this.loadEntries();
  }

  setType(type: CashflowType): void {
    this.entryForm.patchValue({ type });
  }

  clearDraft(): void {
    this.entryForm.reset({
      type: 'expense',
      name: '',
      category: '',
      amount: null,
      date: this.today()
    });
  }

  formatMoney(value: number): string {
    return this.moneyFormatter.format(value || 0);
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
  }

  private syncMessage(summary: PlaidSyncSummary): string {
    if (summary.skipped && summary.itemsSynced === 0) {
      return 'Plaid already synced today.';
    }
    return `Plaid synced: ${summary.added} added, ${summary.modified} updated, ${summary.removed} removed.`;
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  private accountGroupRank(group: InstitutionAccountGroup): number {
    return Math.min(...group.accounts.map(account => this.accountRank(account)));
  }

  private comparePlaidAccounts(first: PlaidAccount, second: PlaidAccount): number {
    const rankDifference = this.accountRank(first) - this.accountRank(second);
    return rankDifference || first.name.localeCompare(second.name);
  }

  private accountRank(account: PlaidAccount): number {
    if (account.type === 'depository' && account.subtype === 'checking') {
      return 0;
    }
    if (account.type === 'depository' && account.subtype === 'savings') {
      return 1;
    }
    if (account.type === 'credit') {
      return 2;
    }
    return 3;
  }
}

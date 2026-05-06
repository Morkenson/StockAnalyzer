import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { routes } from '../../app/app-routing.module';
import { IncomeExpensesComponent } from '../../app/components/income-expenses.component';
import { HeaderComponent } from '../../app/components/shared/header.component';
import { AuthGuard } from '../../app/guards/auth.guard';
import { CashflowService } from '../../app/services/cashflow.service';
import { AuthService } from '../../app/services/auth.service';
import { PlaidService } from '../../app/services/plaid.service';

describe('Income & Expenses routing', () => {
  it('guards the income expenses route', () => {
    const route = routes.find(candidate => candidate.path === 'income-expenses');

    expect(route?.component).toBe(IncomeExpensesComponent);
    expect(route?.canActivate).toContain(AuthGuard);
  });

  it('redirects short cashflow routes to income expenses', () => {
    const incomeRoute = routes.find(candidate => candidate.path === 'income');
    const expensesRoute = routes.find(candidate => candidate.path === 'expenses');

    expect(incomeRoute?.redirectTo).toBe('/income-expenses');
    expect(expensesRoute?.redirectTo).toBe('/income-expenses');
  });
});

describe('HeaderComponent income navigation', () => {
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    const authService = {
      currentUser$: new BehaviorSubject({ id: 'user-1', email: 'test@example.com' }).asObservable(),
      isAuthenticated: jest.fn().mockReturnValue(true),
      signOut: jest.fn()
    };

    await TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authService }]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
  });

  it('links to income expenses from the authenticated nav', () => {
    const link = fixture.debugElement
      .queryAll(By.css('nav a'))
      .find(candidate => candidate.nativeElement.textContent.trim() === 'Income');

    expect(link).toBeTruthy();
    expect(link?.attributes['routerLink']).toBe('/income-expenses');
  });
});

describe('IncomeExpensesComponent', () => {
  let fixture: ComponentFixture<IncomeExpensesComponent>;
  let component: IncomeExpensesComponent;
  let cashflowService: { getEntries: jest.Mock; createEntry: jest.Mock; deleteEntry: jest.Mock };
  let plaidService: { getAccounts: jest.Mock; sync: jest.Mock; createLinkToken: jest.Mock; exchangePublicToken: jest.Mock; removeAccount: jest.Mock };

  beforeEach(async () => {
    cashflowService = {
      getEntries: jest.fn().mockResolvedValue([]),
      createEntry: jest.fn().mockResolvedValue({
        id: 'entry-1',
        source: 'manual',
        type: 'expense',
        name: 'Internet',
        category: 'Bills',
        amount: 80,
        date: '2026-05-01',
        pending: false,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z'
      }),
      deleteEntry: jest.fn().mockResolvedValue(undefined)
    };
    plaidService = {
      getAccounts: jest.fn().mockResolvedValue([]),
      sync: jest.fn().mockResolvedValue({ added: 0, modified: 0, removed: 0, itemsSynced: 0, skipped: true }),
      createLinkToken: jest.fn().mockResolvedValue('link-token'),
      exchangePublicToken: jest.fn().mockResolvedValue(undefined),
      removeAccount: jest.fn().mockResolvedValue(undefined)
    };
    const authService = {
      currentUser$: new BehaviorSubject(null).asObservable(),
      isAuthenticated: jest.fn().mockReturnValue(false)
    };

    await TestBed.configureTestingModule({
      declarations: [IncomeExpensesComponent],
      imports: [FormsModule, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: CashflowService, useValue: cashflowService },
        { provide: PlaidService, useValue: plaidService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeExpensesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts empty without mock entries', () => {
    expect(component.entries).toEqual([]);
    expect(component.accounts).toEqual([]);
    expect(component.totalIncome).toBe(0);
    expect(component.totalExpenses).toBe(0);
    expect(component.monthlyBalance).toBe(0);
    expect(component.savingsRate).toBe(0);
  });

  it('adds a new manual entry through the cashflow API', async () => {
    component.entryForm.setValue({
      type: 'expense',
      name: 'Internet',
      category: 'Bills',
      amount: 80,
      date: '2026-05-01'
    });

    await component.addEntry();

    expect(cashflowService.createEntry).toHaveBeenCalledWith({
      type: 'expense',
      name: 'Internet',
      category: 'Bills',
      amount: 80,
      date: '2026-05-01'
    });
    expect(cashflowService.getEntries).toHaveBeenCalledWith(component.selectedMonth);
  });

  it('calculates totals from persisted entries', () => {
    component.entries = [
      {
        id: 'income-1',
        source: 'plaid',
        type: 'income',
        name: 'Paycheck',
        category: 'Payroll',
        amount: 3000,
        date: '2026-05-01',
        pending: false,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z'
      },
      {
        id: 'expense-1',
        source: 'plaid',
        type: 'expense',
        name: 'Groceries',
        category: 'Food',
        amount: 125,
        date: '2026-05-02',
        pending: false,
        createdAt: '2026-05-02T00:00:00Z',
        updatedAt: '2026-05-02T00:00:00Z'
      }
    ];

    expect(component.totalIncome).toBe(3000);
    expect(component.totalExpenses).toBe(125);
    expect(component.monthlyBalance).toBe(2875);
  });

  it('disconnects a Plaid account and refreshes page data', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const account = {
      id: 'account-1',
      plaidAccountId: 'plaid-account-1',
      name: 'Visa',
      type: 'credit',
      subtype: 'credit card',
      currentBalance: 123,
      pending: false
    } as any;

    await component.disconnectPlaidAccount(account);

    expect(plaidService.removeAccount).toHaveBeenCalledWith('account-1');
    expect(plaidService.getAccounts).toHaveBeenCalled();
    expect(cashflowService.getEntries).toHaveBeenCalledWith(component.selectedMonth);
  });
});

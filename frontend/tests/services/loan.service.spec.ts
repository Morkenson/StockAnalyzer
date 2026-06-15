import { NEVER, Subject, firstValueFrom, of, throwError } from 'rxjs';

import { LoanService } from '../../app/services/loan.service';
import { LoanRow } from '../../app/models/loan.model';

describe('LoanService', () => {
  const user = { id: 'user-1', email: 'zach@example.com' };
  const row: LoanRow = {
    id: 'loan-1',
    name: 'Mortgage',
    principal: 250000,
    interestRate: 5.5,
    loanTerm: 30,
    monthlyPayment: 1419.47,
    totalAmountPaid: 511009.2,
    totalInterest: 261009.2,
    notes: undefined,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z'
  };

  let currentUser$: Subject<any>;

  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  function createService(http: any, loggedInUser: any = user) {
    currentUser$ = new Subject<any>();
    const authService = {
      currentUser$,
      getCurrentUser: jest.fn().mockReturnValue(loggedInUser)
    };
    return new LoanService(http as any, authService as any);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with an empty loan list', async () => {
    const service = createService({ get: jest.fn() });

    expect(service.getCurrentLoans()).toEqual([]);
    await expect(firstValueFrom(service.getLoans())).resolves.toEqual([]);
  });

  it('loads, maps and caches loans when a user logs in', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    const loans = service.getCurrentLoans();
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/loans'));
    expect(loans).toHaveLength(1);
    expect(loans[0].id).toBe('loan-1');
    expect(loans[0].monthlyPayment).toBe(1419.47);
    expect(loans[0].notes).toBeUndefined();
    expect(loans[0].createdAt).toEqual(new Date(row.createdAt));
    expect(loans[0].updatedAt).toEqual(new Date(row.updatedAt));
    expect(localStorage.getItem('loans_cache_user-1')).toContain('loan-1');
  });

  it('restores cached loans before the API responds', () => {
    localStorage.setItem('loans_cache_user-1', JSON.stringify([{ ...row, principal: 123 }]));
    const http = { get: jest.fn().mockReturnValue(NEVER) };
    const service = createService(http);

    currentUser$.next(user);

    const loans = service.getCurrentLoans();
    expect(loans[0].principal).toBe(123);
    expect(loans[0].createdAt).toBeInstanceOf(Date);
  });

  it('clears loans and cache on logout', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    currentUser$.next(null);

    expect(service.getCurrentLoans()).toEqual([]);
    expect(localStorage.getItem('loans_cache_user-1')).toBeNull();
  });

  it('creates a loan with a normalized payload and reloads the list', async () => {
    const http = {
      post: jest.fn().mockReturnValue(of({ success: true, data: row })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [row] }))
    };
    const service = createService(http);

    const created = await service.createLoan({
      name: '  Mortgage  ',
      principal: 250000,
      interestRate: 5.5,
      loanTerm: 30,
      monthlyPayment: 1419.47,
      totalAmountPaid: 511009.2,
      totalInterest: 261009.2,
      notes: '   '
    } as any);

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/loans'), {
      name: 'Mortgage',
      principal: 250000,
      interestRate: 5.5,
      loanTerm: 30,
      monthlyPayment: 1419.47,
      totalAmountPaid: 511009.2,
      totalInterest: 261009.2,
      notes: null
    });
    expect(created.id).toBe('loan-1');
    expect(created.createdAt).toEqual(new Date(row.createdAt));
    expect(service.getCurrentLoans()).toHaveLength(1);
  });

  it('updates a loan and refreshes the list', async () => {
    const http = {
      patch: jest.fn().mockReturnValue(of({ success: true, data: row })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [row] }))
    };
    const service = createService(http);

    await service.updateLoan('loan-1', { interestRate: 4.75 });

    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/loans/loan-1'), { interestRate: 4.75 });
    expect(http.get).toHaveBeenCalled();
  });

  it('deletes a loan and refreshes the list', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({ success: true })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [] }))
    };
    const service = createService(http);

    await service.deleteLoan('loan-1');

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/loans/loan-1'));
    expect(service.getCurrentLoans()).toEqual([]);
  });

  it('rejects mutations when no user is authenticated', async () => {
    const http = { post: jest.fn(), patch: jest.fn(), delete: jest.fn(), get: jest.fn() };
    const service = createService(http, null);

    await expect(service.createLoan({ name: 'X' } as any)).rejects.toThrow('User not authenticated');
    await expect(service.updateLoan('loan-1', { principal: 1 })).rejects.toThrow('User not authenticated');
    await expect(service.deleteLoan('loan-1')).rejects.toThrow('User not authenticated');
    expect(http.post).not.toHaveBeenCalled();
    expect(http.patch).not.toHaveBeenCalled();
    expect(http.delete).not.toHaveBeenCalled();
  });

  it('falls back to an empty list when the API fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const http = { get: jest.fn().mockReturnValue(throwError(() => new Error('boom'))) };
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    expect(service.getCurrentLoans()).toEqual([]);
    errorSpy.mockRestore();
  });

  it('refreshLoans reloads from the API', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);

    await service.refreshLoans();

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/loans'));
    expect(service.getCurrentLoans()).toHaveLength(1);
  });
});

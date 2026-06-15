import { of } from 'rxjs';

import { PlaidService } from '../../app/services/plaid.service';
import { PlaidAccount, PlaidSyncSummary } from '../../app/models/cashflow.model';

describe('PlaidService', () => {
  const account: PlaidAccount = {
    id: 'acct-1',
    itemId: 'item-1',
    plaidAccountId: 'plaid-acct-1',
    name: 'Checking',
    type: 'depository',
    currentBalance: 1250.75
  };

  it('creates a link token', async () => {
    const http = {
      post: jest.fn().mockReturnValue(of({ success: true, data: { linkToken: 'link-token-1' } }))
    };
    const service = new PlaidService(http as any);

    await expect(service.createLinkToken()).resolves.toBe('link-token-1');
    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/plaid/link-token'), {});
  });

  it('throws the API message when no link token is returned', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: false, message: 'Plaid down' })) };
    const service = new PlaidService(http as any);

    await expect(service.createLinkToken()).rejects.toThrow('Plaid down');
  });

  it('throws a fallback message when link token creation fails silently', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: false })) };
    const service = new PlaidService(http as any);

    await expect(service.createLinkToken()).rejects.toThrow('Unable to create Plaid Link token');
  });

  it('exchanges a public token with the full payload', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new PlaidService(http as any);
    const payload = { publicToken: 'public-1', institutionId: 'ins-1', institutionName: 'Big Bank' };

    await service.exchangePublicToken(payload);

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/plaid/exchange-public-token'), payload);
  });

  it('syncs transactions and returns the summary', async () => {
    const summary: PlaidSyncSummary = { added: 3, modified: 1, removed: 0, itemsSynced: 2, skipped: false };
    const http = { post: jest.fn().mockReturnValue(of({ success: true, data: summary })) };
    const service = new PlaidService(http as any);

    await expect(service.sync()).resolves.toEqual(summary);
    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/plaid/sync'), { auto: false });
  });

  it('passes auto=true and falls back to an empty summary', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new PlaidService(http as any);

    const summary = await service.sync(true);

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/plaid/sync'), { auto: true });
    expect(summary).toEqual({ added: 0, modified: 0, removed: 0, itemsSynced: 0, skipped: false });
  });

  it('loads linked accounts', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [account] })) };
    const service = new PlaidService(http as any);

    await expect(service.getAccounts()).resolves.toEqual([account]);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/plaid/accounts'));
  });

  it('returns an empty account list when no data is returned', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new PlaidService(http as any);

    await expect(service.getAccounts()).resolves.toEqual([]);
  });

  it('removes an account by id', async () => {
    const http = { delete: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new PlaidService(http as any);

    await service.removeAccount('acct-1');

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/plaid/accounts/acct-1'));
  });

  it('hides an account by id', async () => {
    const http = { patch: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new PlaidService(http as any);

    await service.hideAccount('acct-1');

    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/plaid/accounts/acct-1/hide'), {});
  });
});

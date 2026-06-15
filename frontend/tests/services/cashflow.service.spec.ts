import { of } from 'rxjs';

import { CashflowService } from '../../app/services/cashflow.service';
import { CashflowEntry, CashflowEntryCreate } from '../../app/models/cashflow.model';

describe('CashflowService', () => {
  const entry: CashflowEntry = {
    id: 'entry-1',
    source: 'manual',
    type: 'expense',
    name: 'Groceries',
    merchantName: null,
    category: 'Food',
    amount: 82.5,
    date: '2026-06-05',
    plaidAccountId: null,
    plaidTransactionId: null,
    pending: false,
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z'
  };

  const newEntry: CashflowEntryCreate = {
    type: 'expense',
    name: 'Groceries',
    category: 'Food',
    amount: 82.5,
    date: '2026-06-05'
  };

  it('loads entries for a month with the month query param', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [entry] })) };
    const service = new CashflowService(http as any);

    const entries = await service.getEntries('2026-06');

    expect(entries).toEqual([entry]);
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/cashflow/entries'), {
      params: { month: '2026-06' }
    });
  });

  it('returns an empty list when the entries response has no data', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new CashflowService(http as any);

    await expect(service.getEntries('2026-06')).resolves.toEqual([]);
  });

  it('creates an entry and returns the saved record', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: true, data: entry })) };
    const service = new CashflowService(http as any);

    const created = await service.createEntry(newEntry);

    expect(created).toEqual(entry);
    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/cashflow/entries'), newEntry);
  });

  it('throws the API message when create returns no data', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: false, message: 'Invalid amount' })) };
    const service = new CashflowService(http as any);

    await expect(service.createEntry(newEntry)).rejects.toThrow('Invalid amount');
  });

  it('throws a fallback message when create fails without a message', async () => {
    const http = { post: jest.fn().mockReturnValue(of({ success: false })) };
    const service = new CashflowService(http as any);

    await expect(service.createEntry(newEntry)).rejects.toThrow('Unable to save entry');
  });

  it('deletes an entry by id', async () => {
    const http = { delete: jest.fn().mockReturnValue(of({ success: true })) };
    const service = new CashflowService(http as any);

    await service.deleteEntry('entry-1');

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/cashflow/entries/entry-1'));
  });
});

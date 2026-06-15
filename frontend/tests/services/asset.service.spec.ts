import { NEVER, Subject, firstValueFrom, of, throwError } from 'rxjs';

import { AssetService } from '../../app/services/asset.service';
import { AssetRow } from '../../app/models/asset.model';

describe('AssetService', () => {
  const user = { id: 'user-1', email: 'zach@example.com' };
  const row: AssetRow = {
    id: 'asset-1',
    name: 'Savings',
    assetType: 'cash',
    value: 1000,
    institution: 'Big Bank',
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
    return new AssetService(http as any, authService as any);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with an empty asset list', async () => {
    const service = createService({ get: jest.fn() });

    expect(service.getCurrentAssets()).toEqual([]);
    await expect(firstValueFrom(service.getAssets())).resolves.toEqual([]);
  });

  it('loads, maps and caches assets when a user logs in', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    const assets = service.getCurrentAssets();
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/assets'));
    expect(assets).toHaveLength(1);
    expect(assets[0].id).toBe('asset-1');
    expect(assets[0].institution).toBe('Big Bank');
    expect(assets[0].notes).toBeUndefined();
    expect(assets[0].createdAt).toEqual(new Date(row.createdAt));
    expect(assets[0].updatedAt).toEqual(new Date(row.updatedAt));
    expect(localStorage.getItem('assets_cache_user-1')).toContain('asset-1');
  });

  it('restores cached assets before the API responds', () => {
    localStorage.setItem('assets_cache_user-1', JSON.stringify([{ ...row, value: 999 }]));
    const http = { get: jest.fn().mockReturnValue(NEVER) };
    const service = createService(http);

    currentUser$.next(user);

    const assets = service.getCurrentAssets();
    expect(assets[0].value).toBe(999);
    expect(assets[0].createdAt).toBeInstanceOf(Date);
  });

  it('clears assets and cache on logout', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    currentUser$.next(null);

    expect(service.getCurrentAssets()).toEqual([]);
    expect(localStorage.getItem('assets_cache_user-1')).toBeNull();
  });

  it('creates an asset with a normalized payload and reloads the list', async () => {
    const http = {
      post: jest.fn().mockReturnValue(of({ success: true, data: row })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [row] }))
    };
    const service = createService(http);

    const created = await service.createAsset({
      name: '  Savings  ',
      assetType: 'cash',
      value: 1000,
      institution: '  ',
      notes: undefined
    } as any);

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/assets'), {
      name: 'Savings',
      assetType: 'cash',
      value: 1000,
      institution: null,
      notes: null
    });
    expect(created.id).toBe('asset-1');
    expect(created.createdAt).toEqual(new Date(row.createdAt));
    expect(service.getCurrentAssets()).toHaveLength(1);
  });

  it('updates an asset and refreshes the list', async () => {
    const http = {
      patch: jest.fn().mockReturnValue(of({ success: true, data: row })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [row] }))
    };
    const service = createService(http);

    await service.updateAsset('asset-1', { value: 2000 });

    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/assets/asset-1'), { value: 2000 });
    expect(http.get).toHaveBeenCalled();
  });

  it('deletes an asset and refreshes the list', async () => {
    const http = {
      delete: jest.fn().mockReturnValue(of({ success: true })),
      get: jest.fn().mockReturnValue(of({ success: true, data: [] }))
    };
    const service = createService(http);

    await service.deleteAsset('asset-1');

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/assets/asset-1'));
    expect(service.getCurrentAssets()).toEqual([]);
  });

  it('rejects mutations when no user is authenticated', async () => {
    const http = { post: jest.fn(), patch: jest.fn(), delete: jest.fn(), get: jest.fn() };
    const service = createService(http, null);

    await expect(
      service.createAsset({ name: 'X', assetType: 'cash', value: 1 } as any)
    ).rejects.toThrow('User not authenticated');
    await expect(service.updateAsset('asset-1', { value: 1 })).rejects.toThrow('User not authenticated');
    await expect(service.deleteAsset('asset-1')).rejects.toThrow('User not authenticated');
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

    expect(service.getCurrentAssets()).toEqual([]);
    errorSpy.mockRestore();
  });

  it('refreshAssets reloads from the API', async () => {
    const http = { get: jest.fn().mockReturnValue(of({ success: true, data: [row] })) };
    const service = createService(http);

    await service.refreshAssets();

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/assets'));
    expect(service.getCurrentAssets()).toHaveLength(1);
  });
});

import { Subject, firstValueFrom, of } from 'rxjs';

import { WatchlistService } from '../../app/services/watchlist.service';

describe('WatchlistService', () => {
  const user = { id: 'user-1', email: 'zach@example.com' };
  const defaultRow = {
    id: 'wl-1',
    name: 'Main',
    description: 'Primary list',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const otherRow = {
    id: 'wl-2',
    name: 'Tech',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const itemRow = {
    id: 'item-1',
    symbol: 'AAPL',
    notes: 'long term hold',
    addedDate: '2026-02-01T00:00:00.000Z'
  };

  let currentUser$: Subject<any>;

  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  function createService(http: any, loggedInUser: any = user) {
    currentUser$ = new Subject<any>();
    const authService = {
      currentUser$,
      getCurrentUser: jest.fn().mockReturnValue(loggedInUser)
    };
    return new WatchlistService(http as any, authService as any);
  }

  function watchlistHttp(lists: any[] = [defaultRow, otherRow], items: any[] = [itemRow]) {
    return {
      get: jest.fn((url: string) =>
        url.includes('/items')
          ? of({ success: true, data: items })
          : of({ success: true, data: lists })
      ),
      post: jest.fn().mockReturnValue(of({ success: true })),
      patch: jest.fn().mockReturnValue(of({ success: true })),
      delete: jest.fn().mockReturnValue(of({ success: true }))
    };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('loads watchlists on login, selects the default one and loads its items', async () => {
    const http = watchlistHttp();
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    const watchlists = await firstValueFrom(service.getWatchlists());
    expect(watchlists).toHaveLength(2);
    expect(watchlists[0].createdAt).toEqual(new Date(defaultRow.createdAt));
    expect(await firstValueFrom(service.selectedWatchlistId$)).toBe('wl-1');

    const items = await firstValueFrom(service.getWatchlist());
    expect(items[0].symbol).toBe('AAPL');
    expect(items[0].notes).toBe('long term hold');
    expect(items[0].addedDate).toEqual(new Date(itemRow.addedDate));
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/watchlists/wl-1/items'));
    expect(localStorage.getItem('watchlist_cache_user-1_watchlists')).toContain('wl-1');
  });

  it('creates a default watchlist when the user has none', async () => {
    let lists: any[] = [];
    const http = {
      get: jest.fn((url: string) =>
        url.includes('/items')
          ? of({ success: true, data: [] })
          : of({ success: true, data: lists })
      ),
      post: jest.fn((url: string, body: any) => {
        const created = {
          id: 'wl-new',
          name: body.name,
          description: body.description,
          isDefault: body.isDefault,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        };
        lists = [created];
        return of({ success: true, data: created });
      })
    };
    const service = createService(http);

    currentUser$.next(user);
    await flush();

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/watchlists'), {
      name: 'My Watchlist',
      description: 'Default watchlist',
      isDefault: true
    });
    expect(await firstValueFrom(service.selectedWatchlistId$)).toBe('wl-new');
    expect((await firstValueFrom(service.getWatchlists()))[0].name).toBe('My Watchlist');
  });

  it('trims fields on create and selects the new default watchlist', async () => {
    const http = watchlistHttp();
    http.post.mockReturnValue(of({ success: true, data: { ...defaultRow, id: 'wl-3', name: 'Growth' } }));
    const service = createService(http);

    const created = await service.createWatchlist('  Growth  ', '  Long term  ', true);

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/watchlists'), {
      name: 'Growth',
      description: 'Long term',
      isDefault: true
    });
    expect(created.id).toBe('wl-3');
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(await firstValueFrom(service.selectedWatchlistId$)).toBe('wl-3');
  });

  it('updates a watchlist and reloads the list', async () => {
    const http = watchlistHttp();
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    await service.updateWatchlist('wl-2', { name: 'Renamed' });

    expect(http.patch).toHaveBeenCalledWith(expect.stringContaining('/watchlists/wl-2'), { name: 'Renamed' });
  });

  it('deletes the selected watchlist and moves selection to the remaining one', async () => {
    let lists = [defaultRow, otherRow];
    const http = {
      get: jest.fn((url: string) =>
        url.includes('/items')
          ? of({ success: true, data: [] })
          : of({ success: true, data: lists })
      ),
      delete: jest.fn(() => {
        lists = [otherRow];
        return of({ success: true });
      })
    };
    const service = createService(http);
    currentUser$.next(user);
    await flush();
    expect(await firstValueFrom(service.selectedWatchlistId$)).toBe('wl-1');

    await service.deleteWatchlist('wl-1');
    await flush();

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/watchlists/wl-1'));
    expect(await firstValueFrom(service.selectedWatchlistId$)).toBe('wl-2');
  });

  it('adds a symbol to the selected watchlist in uppercase', async () => {
    const http = watchlistHttp();
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    await service.addToWatchlist('aapl', 'great company');

    expect(http.post).toHaveBeenCalledWith(expect.stringContaining('/watchlists/wl-1/items'), {
      symbol: 'AAPL',
      notes: 'great company'
    });
  });

  it('rejects adding a symbol when no watchlist is selected', async () => {
    const http = watchlistHttp();
    const service = createService(http);

    await expect(service.addToWatchlist('AAPL')).rejects.toThrow('No watchlist selected');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('removes a symbol from the selected watchlist in uppercase', async () => {
    const http = watchlistHttp();
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    await service.removeFromWatchlist('aapl');

    expect(http.delete).toHaveBeenCalledWith(expect.stringContaining('/watchlists/wl-1/items/AAPL'));
  });

  it('checks watchlist membership case-insensitively', async () => {
    const http = watchlistHttp();
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    expect(service.isInWatchlist('aapl')).toBe(true);
    expect(service.isInWatchlist('TSLA')).toBe(false);
  });

  it('clears all watchlist state and cache on logout', async () => {
    const http = watchlistHttp();
    const service = createService(http);
    currentUser$.next(user);
    await flush();

    currentUser$.next(null);

    expect(await firstValueFrom(service.getWatchlists())).toEqual([]);
    expect(await firstValueFrom(service.selectedWatchlistId$)).toBeNull();
    expect(await firstValueFrom(service.getWatchlist())).toEqual([]);
    expect(localStorage.getItem('watchlist_cache_user-1_watchlists')).toBeNull();
  });
});

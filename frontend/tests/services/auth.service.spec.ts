import { of, throwError } from 'rxjs';

import { AuthService, AppUser } from '../../app/services/auth.service';

describe('AuthService', () => {
  const user: AppUser = { id: 'user-1', email: 'zach@example.com' };

  let http: {
    get: jest.Mock;
    post: jest.Mock;
  };
  let router: { navigate: jest.Mock };

  function createService(meResponse: any = of({ success: true, data: { user } })) {
    http = {
      get: jest.fn().mockReturnValue(meResponse),
      post: jest.fn()
    };
    router = { navigate: jest.fn() };
    return new AuthService(http as any, router as any);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('restores the current user from /auth/me', async () => {
    const service = createService();

    await service.waitForInitialization();

    expect(service.getCurrentUser()).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('clears cached user when initialization fails', async () => {
    localStorage.setItem('stock_analyzer_user', JSON.stringify(user));
    const service = createService(throwError(() => ({ error: { detail: 'no session' } })));

    await service.waitForInitialization();

    expect(service.getCurrentUser()).toBeNull();
    expect(localStorage.getItem('stock_analyzer_user')).toBeNull();
  });

  it('signs up and stores the returned user', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(of({ success: true, data: { user } }));

    const result = await service.signUp(user.email, 'password');

    expect(result).toEqual({ user, error: null });
    expect(JSON.parse(localStorage.getItem('stock_analyzer_user') || '{}')).toEqual(user);
  });

  it('uses the cached user while initialization is in flight', () => {
    localStorage.setItem('stock_analyzer_user', JSON.stringify(user));
    const service = createService(of({ success: true }));

    expect(service.getCurrentUser()).toEqual(user);
  });

  it('returns a signup error when the response has no user', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(of({ success: false, message: 'No user returned' }));

    const result = await service.signUp(user.email, 'password');

    expect(result.user).toBeNull();
    expect(result.error.message).toBe('No user returned');
  });

  it('returns normalized signup errors', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(throwError(() => ({ error: { detail: 'Email exists' } })));

    const result = await service.signUp(user.email, 'password');

    expect(result.user).toBeNull();
    expect(result.error.message).toBe('Email exists');
  });

  it('signs in and stores the returned user', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(of({ success: true, data: { user } }));

    const result = await service.signIn(user.email, 'password');

    expect(result.user).toEqual(user);
    expect(service.getCurrentUser()).toEqual(user);
  });

  it('returns normalized signin errors', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(of({ success: false, message: 'Bad credentials' }));

    const result = await service.signIn(user.email, 'password');

    expect(result.user).toBeNull();
    expect(result.error.message).toBe('Bad credentials');
  });

  it('requests and resets passwords', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(of({ success: true, message: 'sent', data: { resetToken: 'token-1' } }));
    http.post.mockReturnValueOnce(of({ success: true }));

    await expect(service.requestPasswordReset(user.email)).resolves.toEqual({ resetToken: 'token-1', message: 'sent' });
    await expect(service.resetPassword('token-1', 'new-password')).resolves.toEqual({});
  });

  it('returns normalized reset errors', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(throwError(() => ({ message: 'bad token' })));
    http.post.mockReturnValueOnce(throwError(() => ({ error: { message: 'weak password' } })));

    expect((await service.requestPasswordReset(user.email)).error.message).toBe('bad token');
    expect((await service.resetPassword('bad', 'short')).error.message).toBe('weak password');
  });

  it('cleans up local auth even when signout fails', async () => {
    const service = createService();
    await service.waitForInitialization();
    http.post.mockReturnValueOnce(throwError(() => new Error('offline')));

    await expect(service.signOut()).rejects.toThrow('offline');

    expect(service.getCurrentUser()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not expose bearer tokens on the frontend', async () => {
    const service = createService();
    await service.waitForInitialization();

    expect(service.getAccessToken()).toBeNull();
  });
});

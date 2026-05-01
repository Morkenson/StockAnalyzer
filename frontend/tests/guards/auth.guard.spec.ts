import { AuthGuard } from '../../app/guards/auth.guard';

describe('AuthGuard', () => {
  function createGuard(isAuthenticated: boolean) {
    const authService = {
      waitForInitialization: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn().mockReturnValue(isAuthenticated)
    };
    const router = { navigate: jest.fn() };
    const guard = new AuthGuard(authService as any, router as any);
    return { guard, authService, router };
  }

  it('allows authenticated users', async () => {
    const { guard, authService, router } = createGuard(true);

    const result = await guard.canActivate({} as any, { url: '/dashboard' } as any);

    expect(result).toBe(true);
    expect(authService.waitForInitialization).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects anonymous users to login', async () => {
    const { guard, router } = createGuard(false);

    const result = await guard.canActivate({} as any, { url: '/portfolio' } as any);

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/portfolio' } });
  });
});

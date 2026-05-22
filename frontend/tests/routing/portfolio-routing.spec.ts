import { routes } from '../../app/app-routing.module';
import { AccountDetailComponent } from '../../app/components/account-detail.component';
import { AuthGuard } from '../../app/guards/auth.guard';

describe('Portfolio routing', () => {
  it('guards the dedicated account detail route', () => {
    const route = routes.find(candidate => candidate.path === 'portfolio/accounts/:accountId');

    expect(route?.component).toBe(AccountDetailComponent);
    expect(route?.canActivate).toContain(AuthGuard);
  });
});

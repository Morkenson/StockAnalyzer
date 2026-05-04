import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { routes } from '../../app/app-routing.module';
import { NetWorthComponent } from '../../app/components/net-worth.component';
import { HeaderComponent } from '../../app/components/shared/header.component';
import { AuthGuard } from '../../app/guards/auth.guard';
import { AuthService } from '../../app/services/auth.service';

describe('Net Worth routing', () => {
  it('guards the primary net worth route', () => {
    const route = routes.find(candidate => candidate.path === 'networth');

    expect(route?.component).toBe(NetWorthComponent);
    expect(route?.canActivate).toContain(AuthGuard);
  });

  it('redirects the old assets route to net worth', () => {
    const route = routes.find(candidate => candidate.path === 'assets');

    expect(route?.redirectTo).toBe('/networth');
    expect(route?.pathMatch).toBe('full');
  });

  it('redirects the old debt calculator route to net worth', () => {
    const route = routes.find(candidate => candidate.path === 'debt-calculator');

    expect(route?.redirectTo).toBe('/networth');
    expect(route?.pathMatch).toBe('full');
  });
});

describe('HeaderComponent net worth navigation', () => {
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

  it('links to net worth from the authenticated nav', () => {
    const link = fixture.debugElement
      .queryAll(By.css('nav a'))
      .find(candidate => candidate.nativeElement.textContent.trim() === 'Net Worth');

    expect(link).toBeTruthy();
    expect(link?.attributes['routerLink']).toBe('/networth');
  });

  it('does not show a standalone debt calculator nav link', () => {
    const labels = fixture.debugElement
      .queryAll(By.css('nav a'))
      .map(candidate => candidate.nativeElement.textContent.trim());

    expect(labels).not.toContain('Debt Calculator');
  });
});

import { HttpErrorResponse, HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { AuthInterceptor } from '../../app/services/auth.interceptor';

describe('AuthInterceptor', () => {
  it('sends backend requests with credentials', done => {
    const authService = { handleUnauthorized: jest.fn() };
    const interceptor = new AuthInterceptor({ get: jest.fn().mockReturnValue(authService) } as any);
    const request = new HttpRequest('GET', '/api/auth/me');
    const next: HttpHandler = {
      handle: jest.fn((handledRequest: HttpRequest<unknown>) => {
        expect(handledRequest.withCredentials).toBe(true);
        return of(new HttpResponse({ status: 200 })) as unknown as ReturnType<HttpHandler['handle']>;
      })
    };

    interceptor.intercept(request, next).subscribe((event: HttpEvent<unknown>) => {
      expect(event).toBeInstanceOf(HttpResponse);
      expect(next.handle).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('attaches the stored bearer token as an Authorization header', done => {
    localStorage.setItem('stock_analyzer_token', 'jwt-token-1');
    const authService = { handleUnauthorized: jest.fn() };
    const interceptor = new AuthInterceptor({ get: jest.fn().mockReturnValue(authService) } as any);
    const request = new HttpRequest('GET', '/api/watchlists');
    const next: HttpHandler = {
      handle: jest.fn((handledRequest: HttpRequest<unknown>) => {
        expect(handledRequest.headers.get('Authorization')).toBe('Bearer jwt-token-1');
        expect(handledRequest.withCredentials).toBe(true);
        return of(new HttpResponse({ status: 200 })) as unknown as ReturnType<HttpHandler['handle']>;
      })
    };

    interceptor.intercept(request, next).subscribe(() => {
      localStorage.removeItem('stock_analyzer_token');
      done();
    });
  });

  it('omits the Authorization header when no token is stored', done => {
    localStorage.removeItem('stock_analyzer_token');
    const authService = { handleUnauthorized: jest.fn() };
    const interceptor = new AuthInterceptor({ get: jest.fn().mockReturnValue(authService) } as any);
    const request = new HttpRequest('GET', '/api/watchlists');
    const next: HttpHandler = {
      handle: jest.fn((handledRequest: HttpRequest<unknown>) => {
        expect(handledRequest.headers.has('Authorization')).toBe(false);
        return of(new HttpResponse({ status: 200 })) as unknown as ReturnType<HttpHandler['handle']>;
      })
    };

    interceptor.intercept(request, next).subscribe(() => done());
  });

  it('clears stale local auth on protected API 401 responses', done => {
    const authService = { handleUnauthorized: jest.fn() };
    const interceptor = new AuthInterceptor({ get: jest.fn().mockReturnValue(authService) } as any);
    const request = new HttpRequest('GET', '/api/watchlists');
    const next: HttpHandler = {
      handle: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 401 })))
    };

    interceptor.intercept(request, next).subscribe({
      error: () => {
        expect(authService.handleUnauthorized).toHaveBeenCalled();
        done();
      }
    });
  });

  it('does not redirect during auth session probing', done => {
    const authService = { handleUnauthorized: jest.fn() };
    const interceptor = new AuthInterceptor({ get: jest.fn().mockReturnValue(authService) } as any);
    const request = new HttpRequest('GET', '/api/auth/me');
    const next: HttpHandler = {
      handle: jest.fn(() => throwError(() => new HttpErrorResponse({ status: 401 })))
    };

    interceptor.intercept(request, next).subscribe({
      error: () => {
        expect(authService.handleUnauthorized).not.toHaveBeenCalled();
        done();
      }
    });
  });
});

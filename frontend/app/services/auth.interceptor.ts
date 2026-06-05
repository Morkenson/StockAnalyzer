import { Injectable, Injector } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Token is read from storage directly (not via AuthService) to avoid a
    // circular dependency during AuthService construction, which itself issues
    // the initial /auth/me request through this interceptor.
    const token = localStorage.getItem('stock_analyzer_token');
    const authReq = req.clone({
      withCredentials: true,
      setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return next.handle(authReq).pipe(
      tap({
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.includes('/auth/me')) {
            this.injector.get(AuthService).handleUnauthorized();
          }
        }
      })
    );
  }
}

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
    return next.handle(req.clone({ withCredentials: true })).pipe(
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

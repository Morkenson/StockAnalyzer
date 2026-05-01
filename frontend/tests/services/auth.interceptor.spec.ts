import { HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

import { AuthInterceptor } from '../../app/services/auth.interceptor';

describe('AuthInterceptor', () => {
  it('sends backend requests with credentials', done => {
    const interceptor = new AuthInterceptor();
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
});

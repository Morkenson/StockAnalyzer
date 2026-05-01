import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AppComponent } from '../app/app.component';

describe('AppComponent', () => {
  function createComponent() {
    const events = new Subject<NavigationEnd>();
    const router = { events } as unknown as Router;
    const component = new AppComponent(router);
    return { component, events };
  }

  it('uses the Mork Wealth title', () => {
    const { component } = createComponent();

    expect(component.title).toBe('Mork Wealth');
  });

  it('hides the header on auth pages', () => {
    const { component, events } = createComponent();

    events.next(new NavigationEnd(1, '/login', '/login'));

    expect(component.showHeader).toBe(false);
  });

  it('shows the header on app pages', () => {
    const { component, events } = createComponent();

    events.next(new NavigationEnd(1, '/dashboard', '/dashboard'));

    expect(component.showHeader).toBe(true);
  });

  it('suppresses known navigator lock browser errors', () => {
    const { component } = createComponent();
    const preventDefault = jest.fn();

    component.ngOnInit();
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new Error('NavigatorLockAcquireTimeoutError'),
        message: 'NavigatorLockAcquireTimeoutError'
      })
    );
    const handled = (component as any).errorHandler({ error: new Error('lock:sb-test'), preventDefault });

    expect(handled).toBe(false);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('allows unrelated browser errors through', () => {
    const { component } = createComponent();
    const preventDefault = jest.fn();

    component.ngOnInit();
    const handled = (component as any).errorHandler({ error: new Error('boom'), preventDefault });

    expect(handled).toBe(true);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('removes global event handlers on destroy', () => {
    const { component } = createComponent();
    const removeEventListener = jest.spyOn(window, 'removeEventListener');

    component.ngOnInit();
    component.ngOnDestroy();

    expect(removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
});

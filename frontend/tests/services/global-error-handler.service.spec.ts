import { GlobalErrorHandler } from '../../app/services/global-error-handler.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    handler = new GlobalErrorHandler();
    consoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('suppresses navigator lock errors by name', () => {
    handler.handleError({ name: 'NavigatorLockAcquireTimeoutError' });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('suppresses navigator lock errors by message', () => {
    handler.handleError({ message: 'Navigator LockManager lock busy' });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs other errors', () => {
    const error = new Error('boom');

    handler.handleError(error);

    expect(consoleError).toHaveBeenCalledWith('Global Error Handler:', error);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentLogger } from './development-logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DevelopmentLogger', () => {
  it('emits structured events in development', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new DevelopmentLogger(false);
    const failure = new Error('failed');

    logger.debug('bookmarks.refresh', { source: 'created' });
    logger.error('bookmarks.refresh.failed', failure);

    expect(debug).toHaveBeenCalledWith('[bookmarks.refresh]', { source: 'created' });
    expect(error).toHaveBeenCalledWith('[bookmarks.refresh.failed]', failure);
  });

  it('does not touch the console in production', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new DevelopmentLogger(true);

    logger.debug('bookmarks.refresh', { source: 'created' });
    logger.error('bookmarks.refresh.failed', new Error('failed'));

    expect(debug).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

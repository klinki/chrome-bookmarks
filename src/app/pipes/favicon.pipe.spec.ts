import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaviconPipe } from './favicon.pipe';

describe('FaviconPipe', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an encoded Chrome favicon URL', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: vi.fn().mockReturnValue('chrome-extension://test/_favicon/')
      }
    });
    const pipe = new FaviconPipe();

    expect(pipe.transform('https://example.com/a path?q=one')).toBe(
      'chrome-extension://test/_favicon/?pageUrl=https%3A%2F%2Fexample.com%2Fa%20path%3Fq%3Done&size=16'
    );
  });

  it('returns an empty value when no URL is available', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: vi.fn().mockReturnValue('chrome-extension://test/_favicon/')
      }
    });
    const pipe = new FaviconPipe();

    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(null)).toBe('');
  });
});

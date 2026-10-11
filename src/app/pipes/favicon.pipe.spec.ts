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

  it.each([
    ['the Chrome API is absent', undefined],
    ['the runtime API is absent', {}],
    ['the runtime has no extension URL', {
      runtime: { getURL: vi.fn().mockReturnValue(undefined) }
    }]
  ])('builds an encoded Google favicon URL when %s', (_, chromeApi) => {
    vi.stubGlobal('chrome', chromeApi);
    const pipe = new FaviconPipe();

    expect(pipe.transform('https://example.com/a path?q=one')).toBe(
      'https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fexample.com%2Fa%20path%3Fq%3Done&size=16'
    );
  });

  it('uses the Google fallback when the extension runtime throws', () => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: vi.fn().mockImplementation(() => {
          throw new Error('Extension context invalidated');
        })
      }
    });
    const pipe = new FaviconPipe();

    expect(pipe.transform('https://example.com')).toBe(
      'https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fexample.com&size=16'
    );
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(null)).toBe('');
  });
});

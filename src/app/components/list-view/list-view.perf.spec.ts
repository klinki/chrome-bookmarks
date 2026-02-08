import { vi, describe, it, expect, beforeAll } from 'vitest';

describe('Performance: getFavicon', () => {
  let chromeMock: any;
  let optimizedGetFavicon: (urlStr: string | undefined) => string;

  beforeAll(() => {
    chromeMock = {
      runtime: {
        getURL: (path: string) => `chrome-extension://mock-id${path}`
      }
    };
    (global as any).chrome = chromeMock;

    // Initialize optimized logic AFTER chrome is mocked
    const baseUrl = chromeMock.runtime.getURL("/_favicon/") ?? 'https://www.google.com/s2/favicons';
    optimizedGetFavicon = (urlStr: string | undefined) => {
      if (urlStr != null) {
         try {
           return baseUrl + "?pageUrl=" + encodeURIComponent(urlStr) + "&size=16";
         } catch (e) {
           return '';
         }
      }
      return '';
    };
  });

  const originalGetFavicon = (item: { url?: string }) => {
    if (item?.url != null) {
      try {
        const url = new URL((global as any).chrome?.runtime?.getURL("/_favicon/") ?? 'https://www.google.com/s2/favicons');
        url.searchParams.set("pageUrl", item.url);
        url.searchParams.set("size", "16");
        return url.toString();
      } catch (e) {
        return '';
      }
    }
    return '';
  };

  it('should be faster optimized', () => {
    const iterations = 100000;
    const item = { url: "https://www.example.com/some/path" };

    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      originalGetFavicon(item);
    }
    const end1 = performance.now();
    const duration1 = end1 - start1;

    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      optimizedGetFavicon(item.url);
    }
    const end2 = performance.now();
    const duration2 = end2 - start2;

    console.log(`Original: ${duration1.toFixed(2)}ms`);
    console.log(`Optimized: ${duration2.toFixed(2)}ms`);
    console.log(`Improvement: ${(duration1 / duration2).toFixed(2)}x`);

    expect(duration2).toBeLessThan(duration1);
  });
});

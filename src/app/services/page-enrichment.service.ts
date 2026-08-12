import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PageEnrichmentService {
  public async enable(): Promise<boolean> {
    return Boolean(await chrome.permissions?.request?.({ origins: ['http://*/*', 'https://*/*'] }));
  }
  public async revoke(): Promise<boolean> {
    return Boolean(await chrome.permissions?.remove?.({ origins: ['http://*/*', 'https://*/*'] }));
  }
  public async extract(url: string, signal?: AbortSignal): Promise<string | null> {
    const timeout = AbortSignal.timeout(10_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await fetch(url, { credentials: 'omit', signal: combined, redirect: 'follow' });
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) return null;
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 2 * 1024 * 1024) return null;
      const html = await response.text();
      if (new Blob([html]).size > 2 * 1024 * 1024) return null;
      const document = new DOMParser().parseFromString(html, 'text/html');
      document.querySelectorAll('script,style,noscript').forEach(node => node.remove());
      const metadata = [document.title,
        ...Array.from(document.querySelectorAll('meta[name="description"],h1,h2,h3'))
          .map(node => node.getAttribute('content') ?? node.textContent ?? '')];
      const text = [...metadata, document.body?.textContent ?? ''].join('\n').replace(/\s+/gu, ' ').trim();
      return text.slice(0, 6_000);
    } catch { return null; }
  }
}

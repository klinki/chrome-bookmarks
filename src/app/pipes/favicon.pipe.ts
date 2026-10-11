import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'favicon',
  standalone: true
})
export class FaviconPipe implements PipeTransform {
  private readonly baseUrl: string;
  private readonly urlParameter: 'pageUrl' | 'domain_url';

  constructor() {
    let extensionFaviconUrl: string | undefined;
    try {
      extensionFaviconUrl = chrome?.runtime?.getURL('/_favicon/');
    } catch {
      extensionFaviconUrl = undefined;
    }
    this.baseUrl = extensionFaviconUrl ?? 'https://www.google.com/s2/favicons';
    this.urlParameter = extensionFaviconUrl != null ? 'pageUrl' : 'domain_url';
  }

  // https://developer.chrome.com/docs/extensions/how-to/ui/favicons
  transform(url: string | undefined | null): string {
    if (url) {
      return this.baseUrl + '?' + this.urlParameter + '=' + encodeURIComponent(url) + '&size=16';
    }
    return '';
  }
}

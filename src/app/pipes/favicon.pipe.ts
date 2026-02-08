import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'favicon',
  standalone: true
})
export class FaviconPipe implements PipeTransform {
  private readonly baseUrl: string;

  constructor() {
    try {
      this.baseUrl = chrome?.runtime?.getURL("/_favicon/") ?? 'https://www.google.com/s2/favicons';
    } catch (e) {
      this.baseUrl = 'https://www.google.com/s2/favicons';
    }
  }

  // https://developer.chrome.com/docs/extensions/how-to/ui/favicons
  transform(url: string | undefined | null): string {
    if (url) {
      return this.baseUrl + "?pageUrl=" + encodeURIComponent(url) + "&size=16";
    }
    return '';
  }
}

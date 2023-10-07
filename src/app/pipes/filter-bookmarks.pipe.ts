import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterBookmarks',
  standalone: true,
})
export class FilterBookmarksPipe implements PipeTransform {

  transform(bookmarks: chrome.bookmarks.BookmarkTreeNode[], args?: any): any {
    return bookmarks.filter((bookmark) => bookmark.url === undefined);
  }
}

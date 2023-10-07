import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterBookmarks',
  standalone: true,
})
export class FilterBookmarksPipe implements PipeTransform {

  transform(bookmarks: chrome.bookmarks.BookmarkTreeNode[]|null, searchText: string): any {
    return bookmarks?.filter((bookmark) => bookmark.url === undefined) ?? [];
  }
}

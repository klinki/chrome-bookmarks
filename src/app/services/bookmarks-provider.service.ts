import { Injectable } from '@angular/core';
import { BookmarksService } from './chrome';

@Injectable()
export class BookmarksProviderService {
  protected bookmarksService: BookmarksService;

  protected bookmarks: any[] = [];

  public static EmptyDirectory: chrome.bookmarks.BookmarkTreeNode = {
      id: '0',
      title: '',
      children: []
  };

  public static EmptyBookmark = {
      id: '0',
      title: '',
      url: ''
  };

  constructor(bookmarksService: BookmarksService) {
    this.bookmarksService = bookmarksService;
  }

  public getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.bookmarksService.getChildren(id);
  }

  public getBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.bookmarksService.getTree();
  }

  public filterDirectories(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
    let directories = [];
    return bookmarks.filter((bookmark) => bookmark.url === undefined).map((bookmark) => {
      let newBookmark = Object.create(bookmark);
      newBookmark.children = this.filterDirectories(bookmark.children ?? []);

      return newBookmark;
    });;
  }

  public getDirectoryTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.getBookmarks().then((bookmarks) => this.filterDirectories(bookmarks));
  }
}

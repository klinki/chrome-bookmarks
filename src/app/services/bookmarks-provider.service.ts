import { Injectable } from '@angular/core';

@Injectable()
export class BookmarksProviderService {
  protected bookmarks;
  
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

  constructor() {

  }

  public getChildren(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return new Promise(function(resolve, reject) {
      return chrome.bookmarks.getChildren(id, resolve);
    });
  }

  public getBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {   
    return new Promise(function(resolve, reject) {
        return chrome.bookmarks.getTree(resolve);
    });
  }

  public filterDirectories(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
    let directories = [];
    return bookmarks.filter((bookmark) => bookmark.url === undefined).map((bookmark) => {
      let newBookmark = Object.create(bookmark);
      newBookmark.children = this.filterDirectories(bookmark.children);
      
      return newBookmark;
    });;
  }

  public getDirectoryTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
    return this.getBookmarks().then((bookmarks) => this.filterDirectories(bookmarks));
  }
}

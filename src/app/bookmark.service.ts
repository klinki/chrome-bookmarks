import { Injectable } from '@angular/core';
import {Subject} from 'rxjs/Subject';
import {Observable} from 'rxjs/Observable';

@Injectable()
export class BookmarkService {
  protected selectionChanged: Subject<chrome.bookmarks.BookmarkTreeNode>;
  public onSelectionChanged: Observable<chrome.bookmarks.BookmarkTreeNode>;
  
  protected selectedBookmark: chrome.bookmarks.BookmarkTreeNode;


  constructor() {
    this.selectionChanged = new Subject<chrome.bookmarks.BookmarkTreeNode>();
    this.onSelectionChanged = this.selectionChanged.asObservable();
  }

  public select(bookmark: chrome.bookmarks.BookmarkTreeNode) {
    this.selectedBookmark = bookmark;
    this.selectionChanged.next(this.selectedBookmark);
  }

  public getSelectedBookmark(): chrome.bookmarks.BookmarkTreeNode {
    return this.selectedBookmark;
  }
}

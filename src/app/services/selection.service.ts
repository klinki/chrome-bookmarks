import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class SelectionService {
  protected selectionChanged: Subject<chrome.bookmarks.BookmarkTreeNode>;
  public onSelectionChanged$: Observable<chrome.bookmarks.BookmarkTreeNode>;

  protected selectedBookmark: null|chrome.bookmarks.BookmarkTreeNode & { selected: boolean } = null;

  protected search = {
    term: '',
    result: []
  };

  constructor() {
    this.selectionChanged = new Subject<chrome.bookmarks.BookmarkTreeNode>();
    this.onSelectionChanged$ = this.selectionChanged.asObservable();
  }

  public select(bookmark: chrome.bookmarks.BookmarkTreeNode) {
    if (this.selectedBookmark) {
      this.selectedBookmark['selected'] = false;
    }

    this.selectedBookmark = { ...bookmark, selected: true };
    this.selectedBookmark['selected'] = true;
    this.selectionChanged.next(this.selectedBookmark);
  }

  public getSelectedBookmark() {
    return this.selectedBookmark;
  }
}

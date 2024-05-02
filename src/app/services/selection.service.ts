import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';

@Injectable()
export class SelectionService {
  // private selectionModel: SelectionModel

  protected selectionChanged = new BehaviorSubject<Set<string>>(new Set());
  public onSelectionChanged$ = this.selectionChanged.asObservable();

  protected selectedBookmark: null|chrome.bookmarks.BookmarkTreeNode & { selected: boolean } = null;

  public selectedDirectory$ = new BehaviorSubject<chrome.bookmarks.BookmarkTreeNode|null>(null);

  protected search = {
    term: '',
    result: []
  };

  private selection = new Set<string>();

  public selectAllActive = false;

  constructor() {
  }

  public select(bookmark: chrome.bookmarks.BookmarkTreeNode, config: {
    clear: boolean,
    range: boolean,
    toggle: boolean
  }) {
    let newItems = new Set<string>();

    if (!config.clear) {
      newItems = new Set(this.selection);
    } else {
      this.selectAllActive = false;
    }

    if (newItems.has(bookmark.id)) {
      newItems.delete(bookmark.id);
    } else {
      newItems.add(bookmark.id);
    }

    this.selection = newItems;
    this.selectionChanged.next(this.selection);
  }

  public selectDirectory(bookmark: chrome.bookmarks.BookmarkTreeNode) {
    console.log('sel directory');
    this.selectedDirectory$.next(bookmark);
    this.clearSelection(true);
  }

  public getSelectedBookmark() {
    return this.selectedBookmark;
  }

  public clearSelection(sendEvent: boolean = true) {
    this.selectAllActive = false;
    this.selection.clear();

    if (sendEvent) {
      this.selectionChanged.next(this.selection);
    }
  }

  public selectAll() {
    this.clearSelection(false);
    this.selectAllActive = true;
    this.selectionChanged.next(this.selection);
  }
}

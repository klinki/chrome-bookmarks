import {inject, Injectable} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {toSignal} from "@angular/core/rxjs-interop";

@Injectable()
export class SelectionService {
  protected selectionChanged = new BehaviorSubject<Set<string>>(new Set());
  public onSelectionChanged$ = this.selectionChanged.asObservable();

  protected selectedBookmark: null|chrome.bookmarks.BookmarkTreeNode & { selected: boolean } = null;

  /**
   * Directory selected in left tree view
   */
  public selectedDirectory$ = new BehaviorSubject<chrome.bookmarks.BookmarkTreeNode|null>(null);

  protected search = {
    term: '',
    result: []
  };

  private selection = new Set<string>();
  private lastSelectedItem: chrome.bookmarks.BookmarkTreeNode|null = null;

  public selectAllActive = false;

  private _items: chrome.bookmarks.BookmarkTreeNode[] = [];

  public get items() {
    return this._items;
  }
  public set items(items: chrome.bookmarks.BookmarkTreeNode[]) {
    this._items = items ?? [];
  }

  constructor() {
  }

  public select(bookmark: chrome.bookmarks.BookmarkTreeNode, config: {
    clear?: boolean,
    range?: boolean,
    toggle?: boolean
  }) {
    let newItems = new Set<string>();

    if (!config.clear) {
      newItems = new Set(this.selection);
    } else {
      this.selectAllActive = false;
    }

    if (config.range && this.lastSelectedItem != null) {
      const range = [
        this.items.indexOf(this.lastSelectedItem),
        this.items.indexOf(bookmark),
      ];

      const selectedRangeFrom = Math.min(...range);
      const selectedRangeTo = Math.max(...range);

      const selectedIds = this.items.slice(selectedRangeFrom, selectedRangeTo + 1)
        .map(x => x.id);

      newItems = new Set(selectedIds);
    } else if (!config.range) {
      if (newItems.has(bookmark.id)) {
        newItems.delete(bookmark.id);
      } else {
        newItems.add(bookmark.id);
      }
    }

    this.selection = newItems;
    this.selectionChanged.next(this.selection);

    if (!config.range) {
      this.lastSelectedItem = bookmark
    }
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

export function injectSelectItemCallback() {
  const service = inject(SelectionService);
  return (item: chrome.bookmarks.BookmarkTreeNode) => service.select(item, { clear: true });
}

export function injectSelectedFolderSignal() {
  return toSignal(inject(SelectionService).selectedDirectory$);
}

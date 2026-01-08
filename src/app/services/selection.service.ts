import { Injectable, signal } from '@angular/core';
import { inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class SelectionService {
  protected selectionChanged = new BehaviorSubject<Set<string>>(new Set());
  public onSelectionChanged$ = this.selectionChanged.asObservable();

  protected selectedBookmark: null|chrome.bookmarks.BookmarkTreeNode & { selected: boolean } = null;

  /**
   * Directory selected in left tree view
   */
  private _selectedDirectory = signal<chrome.bookmarks.BookmarkTreeNode | null>(null);
  public selectedDirectory = this._selectedDirectory.asReadonly();

  protected search = {
    term: '',
    result: []
  };

  private _selection = signal<Set<string>>(new Set());
  public selection = this._selection.asReadonly();

  private lastSelectedItem: chrome.bookmarks.BookmarkTreeNode | null = null;

  public selectAllActive = signal(false);

  private _items = signal<chrome.bookmarks.BookmarkTreeNode[]>([]);
  public itemsSignal = this._items.asReadonly();

  public get items() {
    return this._items();
  }

  public set items(items: chrome.bookmarks.BookmarkTreeNode[]) {
    this._items.set(items ?? []);
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
      newItems = new Set(this._selection());
    } else {
      this.selectAllActive.set(false);
    }

    if (config.range && this.lastSelectedItem != null) {
      const items = this._items();
      const range = [
        items.indexOf(this.lastSelectedItem),
        items.indexOf(bookmark),
      ];

      const selectedRangeFrom = Math.min(...range);
      const selectedRangeTo = Math.max(...range);

      const selectedIds = items.slice(selectedRangeFrom, selectedRangeTo + 1)
        .map(x => x.id);

      newItems = new Set(selectedIds);
    } else if (!config.range) {
      if (newItems.has(bookmark.id)) {
        newItems.delete(bookmark.id);
      } else {
        newItems.add(bookmark.id);
      }
    }

    this._selection.set(newItems);

    if (!config.range) {
      this.lastSelectedItem = bookmark;
    }
  }

  public selectDirectory(bookmark: chrome.bookmarks.BookmarkTreeNode) {
    console.log('sel directory');
    this._selectedDirectory.set(bookmark);
    this.clearSelection(true);
  }

   public getSelectedBookmark() {
    return this.selectedBookmark;
  }

  public clearSelection(sendEvent: boolean = true) {
    this.selectAllActive.set(false);
    this._selection.set(new Set());

    if (sendEvent) {
      this.selectionChanged.next(this._selection());
    }
  }

  public selectAll() {
    this.clearSelection(false);
    this.selectAllActive.set(true);
    this._selection.set(new Set()); // In "selectAllActive" mode, selection set might be used for exclusions if needed, but for now we keep it empty or full depending on logic
  }
}

export function injectSelectItemCallback() {
  const service = inject(SelectionService);
  return (item: chrome.bookmarks.BookmarkTreeNode) => service.select(item, { clear: true });
}

export function injectSelectedFolderSignal() {
  return inject(SelectionService).selectedDirectory;
}

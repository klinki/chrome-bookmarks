import { Injectable, signal, untracked } from '@angular/core';
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
  private _expandedDirectoryIds = signal<ReadonlySet<string>>(new Set());
  public expandedDirectoryIds = this._expandedDirectoryIds.asReadonly();


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


  public select(bookmark: chrome.bookmarks.BookmarkTreeNode, config: {
    clear?: boolean,
    range?: boolean,
    toggle?: boolean
  }) {
    let newItems = new Set<string>();
    const items = this._items();
    const anchorIndex = this.lastSelectedItem != null ? items.indexOf(this.lastSelectedItem) : -1;
    const bookmarkIndex = items.indexOf(bookmark);
    const canSelectRange = !!config.range && anchorIndex >= 0 && bookmarkIndex >= 0;

    if (!config.clear) {
      newItems = new Set(this._selection());
    } else {
      this.selectAllActive.set(false);
    }

    if (canSelectRange) {
      const selectedRangeFrom = Math.min(anchorIndex, bookmarkIndex);
      const selectedRangeTo = Math.max(anchorIndex, bookmarkIndex);

      items.slice(selectedRangeFrom, selectedRangeTo + 1)
        .forEach(item => newItems.add(item.id));
    } else if (!config.range) {
      if (newItems.has(bookmark.id)) {
        newItems.delete(bookmark.id);
      } else {
        newItems.add(bookmark.id);
      }
    } else {
      // Shift-selection should still behave sensibly when the anchor was
      // cleared or no longer exists in the current list.
      newItems.add(bookmark.id);
    }

    this._selection.set(newItems);

    if (!config.range || !canSelectRange) {
      this.lastSelectedItem = bookmark;
    }
  }

  public selectDirectory(bookmark: chrome.bookmarks.BookmarkTreeNode) {
    this._selectedDirectory.set(bookmark);
    this.clearSelection(true);
  }

  public clearDirectorySelection() {
    this._selectedDirectory.set(null);
    this.clearSelection(true);
  }
  public isDirectoryExpanded(directoryId: string): boolean {
    return this._expandedDirectoryIds().has(directoryId);
  }

  public toggleDirectory(directoryId: string): void {
    const expandedIds = new Set(this._expandedDirectoryIds());
    if (expandedIds.has(directoryId)) {
      expandedIds.delete(directoryId);
    } else {
      expandedIds.add(directoryId);
    }
    this._expandedDirectoryIds.set(expandedIds);
  }

  public expandDirectories(directoryIds: Iterable<string>): void {
    const currentIds = untracked(this._expandedDirectoryIds);
    const expandedIds = new Set(currentIds);
    for (const directoryId of directoryIds) {
      expandedIds.add(directoryId);
    }

    if (expandedIds.size !== currentIds.size) {
      this._expandedDirectoryIds.set(expandedIds);
    }
  }


   public getSelectedBookmark() {
    return this.selectedBookmark;
  }

  public clearSelection(sendEvent: boolean = true) {
    this.selectAllActive.set(false);
    this._selection.set(new Set());
    this.lastSelectedItem = null;

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

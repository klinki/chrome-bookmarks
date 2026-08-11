import { Component, HostListener, input, signal, inject, ChangeDetectionStrategy,
  computed, effect } from '@angular/core';

import { DatePipe } from '@angular/common';
import { CdkContextMenuTrigger } from "@angular/cdk/menu";

import {
  SelectionService,
  BookmarksFacadeService,
  TagsService,
  UsefulnessService
} from "../../services";
import {
  BookmarkSortColumn,
  BookmarkSortValueAccessor,
  OrderByPipe,
  OrderProperties
} from "../../pipes/order-by.pipe";
import { FaviconPipe } from "../../pipes/favicon.pipe";
import { BookmarkMenuComponent } from '../menus/bookmark-menu/bookmark-menu.component';
import { FolderIconComponent } from '../folder-icon/folder-icon.component';

@Component({
  standalone: true,
  selector: 'app-list-view',
  templateUrl: 'list-view.component.html',
  styleUrls: ['list-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FaviconPipe,
    CdkContextMenuTrigger,
    BookmarkMenuComponent,
    FolderIconComponent,
    DatePipe
  ],

})
export class ListViewComponent {
  public items = input<chrome.bookmarks.BookmarkTreeNode[] | null>([]);
  public selectedItems = input<Set<string>>(new Set());

  public contextMenuBookmark: chrome.bookmarks.BookmarkTreeNode | null = null;

  public orderProperties = signal<OrderProperties>({
    column: '',
    asc: true
  });

  public availableColumns: ReadonlyArray<{ title: string; name: BookmarkSortColumn }> = [
    {
      title: 'Title',
      name: 'title'
    },
    {
      title: 'URL',
      name: 'url'
    },
    {
      title: 'Date added',
      name: 'dateAdded'
    },
    {
      title: 'Last Used',
      name: 'dateLastUsed'
    },
    {
      title: 'Tags',
      name: 'tags'
    },
    {
      title: 'Usefulness',
      name: 'usefulness'
    }
  ];

  public displayedColumns = [
    this.availableColumns[0],
    this.availableColumns[1],
    this.availableColumns[4], // Tags
    this.availableColumns[5], // Usefulness
    this.availableColumns[2],
    this.availableColumns[3]
  ];

  protected selectionService = inject(SelectionService);
  protected bookmarksFacade = inject(BookmarksFacadeService);
  protected tagsService = inject(TagsService);
  protected usefulnessService = inject(UsefulnessService);
  private readonly orderByPipe = new OrderByPipe();
  private readonly sortValueAccessor: BookmarkSortValueAccessor =
    (item, column) => this.getColumnValue(item, column);
  public deleteProgress = this.bookmarksFacade.deleteProgress;

  public visibleItems = computed(() => {
    return this.orderByPipe.transform(
      this.items() ?? [],
      this.orderProperties(),
      this.sortValueAccessor
    );
  });

  private readonly syncSelectionItems = effect(() => {
    this.selectionService.items = this.visibleItems();
  });

  public isSelected(item: chrome.bookmarks.BookmarkTreeNode) {
    if (this.selectionService.selectAllActive()) {
      return !this.selectedItems().has(item.id);
    }

    return this.selectedItems().has(item.id);
  }


  public orderBy(column: BookmarkSortColumn) {
    const current = this.orderProperties();
    if (!current || column !== current.column) {
      this.orderProperties.set({
        column: column,
        asc: true
      });
    } else {
      this.orderProperties.set({
        ...current,
        asc: !current.asc
      });
    }
  }

  public getAriaSort(column: BookmarkSortColumn): 'ascending' | 'descending' | 'none' {
    if (this.orderProperties().column !== column) {
      return 'none';
    }

    return this.orderProperties().asc ? 'ascending' : 'descending';
  }

  public getColumnValue(
    item: chrome.bookmarks.BookmarkTreeNode,
    column: BookmarkSortColumn
  ): string | number | undefined {
    if (column === 'tags') {
      return this.tagsService.getTagsForBookmark(item.id).join(', ');
    }
    if (column === 'usefulness') {
      return item.url
        ? this.usefulnessService.getRatingForBookmark(item.id)?.score
        : undefined;
    }

    return this.getNativeColumnValue(item, column);
  }

  private getNativeColumnValue(
    item: chrome.bookmarks.BookmarkTreeNode,
    column: Exclude<BookmarkSortColumn, 'tags' | 'usefulness'>
  ): string | number | undefined {
    if (column === 'dateLastUsed') {
      return (item as chrome.bookmarks.BookmarkTreeNode & { dateLastUsed?: number }).dateLastUsed;
    }

    return item[column];
  }

  private getSelectedBookmarksForAction() {
    const selectedIds = this.selectionService.selection();
    const items = this.visibleItems();

    if (this.selectionService.selectAllActive()) {
      return items.filter(item => !selectedIds.has(item.id));
    }

    return items.filter(item => selectedIds.has(item.id));
  }

  public itemClick(e: MouseEvent, item: chrome.bookmarks.BookmarkTreeNode) {
    // Ignore double clicks so that Ctrl double-clicking an item won't deselect
    // the item before opening.
    if (e.detail !== 2) {
      const addKey = e.metaKey || e.ctrlKey;

      this.selectionService.select(item, {
        clear: !addKey,
        range: e.shiftKey,
        toggle: addKey && !e.shiftKey
      });

    }

    e.stopPropagation();
    e.preventDefault();
  }

  public onItemKeydown(
    event: KeyboardEvent,
    item: chrome.bookmarks.BookmarkTreeNode
  ): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.itemDoubleClick(item);
      return;
    }

    if (event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const additive = event.metaKey || event.ctrlKey;
    this.selectionService.select(item, {
      clear: !additive,
      range: event.shiftKey,
      toggle: additive && !event.shiftKey
    });
  }

  public itemDoubleClick(item: chrome.bookmarks.BookmarkTreeNode) {
    if ((item?.children?.length ?? 0) === 0 && item.url != null) {
      window.open(item.url, '_blank');
    } else {
      this.selectionService.selectDirectory(item);
    }
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyup(event: KeyboardEvent) {
    if ((event.target as HTMLElement).localName === 'input') {
      return true;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      this.selectionService.selectAll();
      return false;
    } else if (event.key == 'Delete') {
      const selectedBookmarks = this.getSelectedBookmarksForAction();

      if (selectedBookmarks.length > 0) {
        const count = selectedBookmarks.length;
        const message = count === 1
          ? `Are you sure you want to delete "${selectedBookmarks[0].title}"?`
          : `Are you sure you want to delete ${count} items?`;

        if (confirm(message)) {
          // Yield to the browser so the native confirm dialog can close before
          // the delete work and refresh storm begin.
          window.setTimeout(() => {
            void this.bookmarksFacade.deleteBookmarks(selectedBookmarks);
          }, 0);
        }
      }
    }

    return true;
  }
}

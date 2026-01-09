import { Component, OnInit, HostListener, OnChanges, SimpleChanges, input, signal, computed, inject } from '@angular/core';
import { DragulaModule, DragulaService } from "ng2-dragula";

import { SelectionService } from "../../services";
import { OrderByPipe } from "../../pipes/order-by.pipe";

@Component({
  standalone: true,
  selector: 'app-list-view',
  templateUrl: 'list-view.component.html',
  styleUrls: ['list-view.component.scss'],
  imports: [
    DragulaModule,
    OrderByPipe
  ],
  viewProviders: [DragulaService]
})
export class ListViewComponent implements OnInit, OnChanges {
  public items = input<chrome.bookmarks.BookmarkTreeNode[] | null>([]);
  public columns = input<string[]>([]);
  public selectedColumns = input<string[]>([]);
  public selectedItems = input<Set<string>>(new Set());

  public orderProperties = signal({
    column: '',
    asc: true
  });

  public availableColumns = [
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
    }
  ];

  public displayedColumns = [
    this.availableColumns[0],
    this.availableColumns[1],
    this.availableColumns[2],
    this.availableColumns[3]
  ];

  protected selectionService = inject(SelectionService);

  public isSelected(item: chrome.bookmarks.BookmarkTreeNode) {
    if (this.selectionService.selectAllActive()) {
      return !this.selectedItems().has(item.id);
    }

    return this.selectedItems().has(item.id);
  }

  ngOnInit() { }
  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }

  public orderBy(column: string) {
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

  public getColumnValue(item: chrome.bookmarks.BookmarkTreeNode, column: string): string | number | undefined | chrome.bookmarks.BookmarkTreeNode[] {
    return (item as any)[column];
  }

  public itemClick(e: MouseEvent, item: chrome.bookmarks.BookmarkTreeNode) {
    // Ignore double clicks so that Ctrl double-clicking an item won't deselect
    // the item before opening.
    if (e.detail !== 2) {
      const isMac = false; // Could be improved with platform check
      const addKey = isMac ? e.metaKey : e.ctrlKey;

      this.selectionService.select(item, {
        clear: !addKey,
        range: e.shiftKey,
        toggle: addKey && !e.shiftKey
      });

      console.log('click');
      console.log({ item });
    }

    e.stopPropagation();
    e.preventDefault();
  }

  public itemDoubleClick(item: chrome.bookmarks.BookmarkTreeNode) {
    if ((item?.children?.length ?? 0) === 0 && item.url != null) {
      window.open(item.url, '_blank');
    } else {
      this.selectionService.selectDirectory(item);
    }
  }

  // https://developer.chrome.com/docs/extensions/how-to/ui/favicons
  public getFavicon(item: chrome.bookmarks.BookmarkTreeNode) {
    if (item?.url != null) {
      try {
        const url = new URL(chrome?.runtime?.getURL("/_favicon/") ?? 'https://www.google.com/s2/favicons');
        url.searchParams.set("pageUrl", item.url);
        url.searchParams.set("size", "16");
        return url.toString();
      } catch (e) {
        return '';
      }
    }
    return '';
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyup(event: KeyboardEvent) {
    if ((event.target as HTMLElement).localName === 'input') {
      return true;
    }

    if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      event.stopPropagation();
      this.selectionService.selectAll();
      return false;
    } else if (event.key == 'Delete') {

    }
    console.log('keyup..', event);

    return true;
  }
}

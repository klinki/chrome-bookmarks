import {Component, OnInit, Input, OnChanges, SimpleChanges, HostListener} from '@angular/core';
import {DragulaModule, DragulaService} from "ng2-dragula";

import {SelectionService} from "../../services";
import {OrderByPipe} from "../../pipes/order-by.pipe";

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
  @Input() items: chrome.bookmarks.BookmarkTreeNode[]|null = [];

  @Input() columns: string[] = [];
  @Input() selectedColumns: string[] = [];

  @Input() selectedItems: Set<string> = new Set();

  orderProperties = {
    column: '',
    asc: true
  };

  availableColumns = [
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

  displayedColumns = [
    this.availableColumns[0],
    this.availableColumns[1],
    this.availableColumns[2],
    this.availableColumns[3]
  ];

  constructor(private selectionService: SelectionService) {

  }

  isSelected(item: chrome.bookmarks.BookmarkTreeNode) {
    if (this.selectionService.selectAllActive) {
      return !this.selectedItems.has(item.id);
    }

    return this.selectedItems.has(item.id);
  }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }

  orderBy(column: string) {
    if (!this.orderProperties || column !== this.orderProperties.column) {
      this.orderProperties = {
        column: column,
        asc: true
      };
    } else {
      this.orderProperties = {
        ...this.orderProperties,
        asc: !this.orderProperties.asc
      };
    }
  }

  getColumnValue(item: chrome.bookmarks.BookmarkTreeNode, column: string): string | number | undefined | chrome.bookmarks.BookmarkTreeNode[] {
    return item[column as keyof chrome.bookmarks.BookmarkTreeNode];
  }

  itemClick(e: MouseEvent, item: chrome.bookmarks.BookmarkTreeNode) {
    // Ignore double clicks so that Ctrl double-clicking an item won't deselect
    // the item before opening.
    if (e.detail !== 2) {
      const isMac = false;
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

  itemDoubleClick(item: chrome.bookmarks.BookmarkTreeNode) {
    if ((item?.children?.length ?? 0) === 0 && item.url != null) {
      window.open(item.url, '_blank');
    } else {
      this.selectionService.selectDirectory(item);
    }
  }

  // https://developer.chrome.com/docs/extensions/how-to/ui/favicons
  getFavicon(item: chrome.bookmarks.BookmarkTreeNode) {
    if (item?.url != null) {
      const url = new URL(chrome?.runtime?.getURL("/_favicon/") ?? 'https://www.google.com');
      url.searchParams.set("pageUrl", item.url);
      url.searchParams.set("size", "16");
      return url.toString();
    }

    return '';
  }

  @HostListener('window:keydown', ['$event'])
  onKeyup(event: KeyboardEvent) {
    if ((event.target as HTMLElement).localName == 'input') {
      return true;
    }

    if (event.ctrlKey && event.key == 'a') {
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

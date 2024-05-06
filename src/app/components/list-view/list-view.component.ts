import {Component, OnInit, Input, OnChanges, SimpleChanges, HostListener} from '@angular/core';
import {DragulaModule, DragulaService} from "ng2-dragula";
import {NgForOf, NgIf} from "@angular/common";
import {SelectionService} from "../../services";

@Component({
  standalone: true,
  selector: 'app-list-view',
  templateUrl: 'list-view.component.html',
  styleUrls: ['list-view.component.scss'],
  imports: [
    DragulaModule,
    NgForOf,
    NgIf,
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
      name: 'date'
    }
  ];

  displayedColumns = [
    this.availableColumns[0],
    this.availableColumns[1],
    this.availableColumns[2]
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
    const columnKey = column as keyof chrome.bookmarks.BookmarkTreeNode;

    if (!this.orderProperties || column !== this.orderProperties.column) {
      this.orderProperties = {
        column: column,
        asc: true
      };
    } else {
      this.orderProperties.asc = !this.orderProperties.asc;
    }

    let order = this.orderProperties.asc ? 1 : -1;

    this.items?.sort((a, b) => {
      if (a.url && b.url) {
        if ((a[columnKey] ?? 0) > (b[columnKey] ?? 0)) {
          return order;
        } else if ((a[columnKey] ?? 0) < (b[columnKey] ?? 0)) {
          return -order;
        } else {
          return 0;
        }
      } else if (a.url) {
        return order;
      } else {
        return -order;
      }
    });
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

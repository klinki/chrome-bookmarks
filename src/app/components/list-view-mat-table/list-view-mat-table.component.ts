import {Component, HostListener, Input, SimpleChanges, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatTableDataSource, MatTableModule} from "@angular/material/table";
import {MatSort, MatSortModule} from "@angular/material/sort";
import {SelectionService} from "../../services";
import {
  CdkTableFixedSizeVirtualScroll,
  CdkTableVirtualScrollable,
  CdkTableVirtualScrollDataHandler
} from "@ngx-nova/material-extensions-table-virtual-scroll";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";

@Component({
  selector: 'app-list-view-mat-table',
  standalone: true,
  imports: [
    CommonModule,
    CdkTableFixedSizeVirtualScroll,
    CdkTableVirtualScrollDataHandler,
    CdkTableVirtualScrollable,
    MatSortModule,
    MatTableModule,
//    NoopAnimationsModule,
  ],
  templateUrl: './list-view-mat-table.component.html',
  styleUrl: './list-view-mat-table.component.scss'
})
export class ListViewMatTableComponent {
  @Input() set items(items: chrome.bookmarks.BookmarkTreeNode[]|null) {
    this.dataSource = new MatTableDataSource(items ?? []);
    this.dataSource.sort = this.sort;
  }

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

  displayedColumnNames = this.displayedColumns.map(x => x.name);

  dataSource = new MatTableDataSource<chrome.bookmarks.BookmarkTreeNode>();

  @ViewChild(MatSort)
  sort!: MatSort;

  constructor(private selectionService: SelectionService) {

  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
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

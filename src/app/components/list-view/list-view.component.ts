import {Component, OnInit, Input, OnChanges, SimpleChanges} from '@angular/core';
import {DragulaModule, DragulaService} from "ng2-dragula";
import {NgForOf, NgIf} from "@angular/common";
import {FilterBookmarksPipe} from "../../pipes";
import {SelectionService} from "../../services";

@Component({
  standalone: true,
  selector: 'app-list-view',
  templateUrl: 'list-view.component.html',
  styleUrls: ['list-view.component.css'],
  imports: [
    DragulaModule,
    NgForOf,
    NgIf,
    FilterBookmarksPipe
  ],
  viewProviders: [DragulaService]
})
export class ListViewComponent implements OnInit, OnChanges {
  @Input() items: chrome.bookmarks.BookmarkTreeNode[]|null = [];

  @Input() columns: string[] = [];
  @Input() selectedColumns: string[] = [];

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

  itemClick(item: chrome.bookmarks.BookmarkTreeNode) {
    this.selectionService.select(item);
    console.log('click');
    console.log({ item });
  }

  itemDoubleClick(item: chrome.bookmarks.BookmarkTreeNode) {
    if ((item?.children?.length ?? 0) === 0 && item.url != null) {
      window.open(item.url, '_blank');
    } else {
      this.selectionService.selectDirectory(item);
    }
  }
}

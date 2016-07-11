import { Component, OnInit, Input } from '@angular/core';

@Component({
  moduleId: module.id,
  selector: 'app-list-view',
  templateUrl: 'list-view.component.html',
  styleUrls: ['list-view.component.css']
})
export class ListViewComponent implements OnInit {
  @Input() items: chrome.bookmarks.BookmarkTreeNode[];

  @Input() columns;
  @Input() selectedColumns;

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

  constructor() {

  }

  ngOnInit() {
  }

  orderBy(column: string) {
    if (!this.orderProperties || column != this.orderProperties.column) {
      this.orderProperties = {
        column: column,
        asc: true
      };
    } else {
      this.orderProperties.asc = !this.orderProperties.asc;
    }

    let order = this.orderProperties.asc ? 1 : -1;

    this.items.sort((a, b) => {
      if (a.url && b.url) {
        if (a[column] > b[column]) {
          return 1 * order;
        } else if (a[column] < b[column]) {
          return -1 * order;
        } else {
          return 0;
        }
      } else if (a.url) {
        return 1 * order;
      } else {
        return -1 * order;
      }
    });
  }
}

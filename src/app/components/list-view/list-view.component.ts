import { Component, OnInit, Input } from '@angular/core';

@Component({
  moduleId: module.id,
  selector: 'app-list-view',
  templateUrl: 'list-view.component.html',
  styleUrls: ['list-view.component.css']
})
export class ListViewComponent implements OnInit {
  @Input() items;

  @Input() columns;
  @Input() selectedColumns;

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

}

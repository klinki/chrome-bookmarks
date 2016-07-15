import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FilterBookmarksPipe } from '../../pipes/index';
import { BookmarksProviderService, SelectionService } from '../../services/index';

@Component({
  moduleId: module.id,
  selector: 'app-tree-view',
  templateUrl: 'tree-view.component.html',
  styleUrls: ['tree-view.component.css'],
  directives: [TreeViewComponent],
  pipes: [FilterBookmarksPipe]
})
export class TreeViewComponent implements OnInit {
  @Input() directories;

  protected bookmarkService: SelectionService;

  constructor(boomarkService: SelectionService) {
    this.bookmarkService = boomarkService;
  }

  ngOnInit() {
  }

  toggle(directory) {
    directory.expanded = !directory.expanded;
  }

  expanded(directory) {
    return directory.expanded;
  }

  isVisible(directory) {
    return directory && !directory.url;
  }

  open(directory) {
    this.bookmarkService.select(directory);
  }
}

import { Component, OnInit, Input } from '@angular/core';
import { SelectionService } from '../../services/index';

@Component({
  moduleId: module.id,
  selector: 'app-tree-item',
  templateUrl: 'tree-item.component.html'
})
export class TreeItemComponent implements OnInit {
  @Input() dir;
  @Input() level: number;

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

  isSelected(directory) {
      return directory.hasOwnProperty('selected') && directory.selected;
  }

  hasSubDirectories(directory: chrome.bookmarks.BookmarkTreeNode) {
      if (directory.children.length > 0) {
        //   directory.children.filter
        var hasSubDirectories = directory.children.reduce((prev, curr, index, arr) => {
            return arr[index].hasOwnProperty('children') && prev; 
        }, true);

        return hasSubDirectories;
      }

      return false;
  }
}

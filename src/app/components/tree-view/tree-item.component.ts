import { Component, OnInit, Input } from '@angular/core';
import { SelectionService } from '../../services';
import {BookmarkDirectory} from "./tree-view.component";
import {NgForOf} from "@angular/common";

@Component({
  standalone: true,
  selector: 'app-tree-item',
  imports: [
    NgForOf
  ],
  templateUrl: './tree-item.component.html'
})
export class TreeItemComponent implements OnInit {
  @Input() dir: any;
  @Input() level: number = 0;
  @Input() selectedItem: any = null;

  constructor(private bookmarkService: SelectionService) {
  }

  ngOnInit() {
  }

  toggle(directory: BookmarkDirectory) {
    console.log(directory);
    directory.expanded = !directory.expanded;
  }

  expanded(directory: BookmarkDirectory) {
    return directory.expanded;
  }

  isVisible(directory: BookmarkDirectory) {
    return directory && !directory.url;
  }

  open(directory: BookmarkDirectory) {
    console.log(directory);
    this.bookmarkService.selectDirectory(directory);
  }

  hasSubDirectories(directory: chrome.bookmarks.BookmarkTreeNode) {
      if ((directory?.children?.length ?? 0) > 0) {
        const hasSubDirectories = directory.children?.reduce((prev, curr, index, arr) => {
            return arr[index].hasOwnProperty('children') && prev;
        }, true);

        return hasSubDirectories;
      }

      return false;
  }
}

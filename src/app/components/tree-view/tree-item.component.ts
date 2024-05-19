import {Component, OnInit, Input, HostBinding} from '@angular/core';
import { SelectionService } from '../../services';
import {BookmarkDirectory} from "./tree-view.component";
import {NgForOf} from "@angular/common";
import {CdkContextMenuTrigger} from "@angular/cdk/menu";
import {FolderMenuComponent} from "../menus/folder-menu/folder-menu.component";

@Component({
  standalone: true,
  selector: 'app-tree-item',
  imports: [
    NgForOf,
    CdkContextMenuTrigger,
    FolderMenuComponent
  ],
  templateUrl: './tree-item.component.html'
})
export class TreeItemComponent implements OnInit {
  @Input() dir: any;
  @Input() level: number = 0;
  @Input() selectedItem: any = null;
  @Input() menu: any;
  @Input() menuComponent?: FolderMenuComponent;

  @HostBinding('attr.itemId')
  get itemId() {
    return this.dir?.id;
  }

  @HostBinding('attr.draggable')
  draggable = true;

  constructor(private bookmarkService: SelectionService) {
  }

  get isSelected() {
    return this.selectedItem?.id === this.dir?.id;
  }

  ngOnInit() {
  }

  toggle(directory: BookmarkDirectory) {
    if (directory.children.length === 0)
      return;

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
    if (this.menuComponent != null) {
      this.menuComponent.folder = directory;
    }
    console.log(directory);
    this.bookmarkService.selectDirectory(directory);
  }

  hasSubDirectories(directory: chrome.bookmarks.BookmarkTreeNode) {
      if ((directory?.children?.length ?? 0) > 0) {
        const hasSubDirectories = directory.children?.reduce((prev, curr, index, arr) => {
            return arr[index].hasOwnProperty('children') && prev;
        }, true) ?? false;

        return hasSubDirectories;
      }

      return false;
  }
}

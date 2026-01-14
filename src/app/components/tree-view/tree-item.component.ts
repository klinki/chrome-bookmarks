import { Component, OnInit, input, Input, HostBinding, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SelectionService } from '../../services';
import { BookmarkDirectory } from "./tree-view.component";

import { CdkContextMenuTrigger } from "@angular/cdk/menu";

@Component({
  standalone: true,
  selector: 'app-tree-item',
  imports: [
    CdkContextMenuTrigger,
    MatIconModule
  ],
  templateUrl: './tree-item.component.html',
  styleUrls: ['./tree-item.component.scss']
})
export class TreeItemComponent implements OnInit {
  private bookmarkService: SelectionService = inject(SelectionService);

  public directory = input<any>();
  public level = input<number>(0);
  public selectedItem = input<any>(null);
  @Input() public menu: any;
  @Input() public menuComponent: any;

  @HostBinding('attr.itemId')
  get itemId() {
    return this.directory()?.id;
  }

  @HostBinding('attr.draggable')
  draggable = true;

  public isSelected = computed(() => {
    return this.selectedItem()?.id === this.directory()?.id;
  });

  ngOnInit() {
  }

  toggle(event: MouseEvent, directory: BookmarkDirectory) {
    event.stopPropagation();
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
    const component = this.menuComponent;
    if (component != null) {
      component.folder = directory;
    }
    console.log(directory);
    this.bookmarkService.selectDirectory(directory);
  }

  onRightClick(event: MouseEvent, directory: BookmarkDirectory) {
    this.bookmarkService.selectDirectory(directory);
  }

  hasSubDirectories(directory: chrome.bookmarks.BookmarkTreeNode) {
    if ((directory?.children?.length ?? 0) > 0) {
      const hasSubDirectories = directory.children?.reduce((prev, curr, index, arr) => {
        return (arr[index] as any).hasOwnProperty('children') && prev;
      }, true) ?? false;

      return hasSubDirectories;
    }

    return false;
  }

  getIcon(directory: any): string {
    if (directory.id?.startsWith('TAG_') || directory.id === 'ROOT_TAGS') {
      return 'label';
    }
    if (directory.id?.startsWith('SERVER_') || directory.id === 'ROOT_SERVERS') {
      return 'dns'; // or public, storage
    }
    // Default folder icons
    if (directory.id === 'ROOT_ALL') {
      return 'bookmarks';
    }

    return directory.expanded ? 'folder_open' : 'folder';
  }
}

import { Component, input, Input, HostBinding, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { SelectionService } from '../../services';
import { BookmarkDirectory } from "./tree-view.component";

import { CdkContextMenuTrigger } from "@angular/cdk/menu";
import { FolderIconComponent } from '../folder-icon/folder-icon.component';

@Component({
  standalone: true,
  selector: 'app-tree-item',
  imports: [
    CdkContextMenuTrigger,
    FolderIconComponent
  ],
  templateUrl: './tree-item.component.html',
  styleUrls: ['./tree-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeItemComponent {
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


  toggle(event: MouseEvent, directory: BookmarkDirectory) {
    event.stopPropagation();
    if (directory.children.length === 0) {
      return;
    }

    this.bookmarkService.toggleDirectory(directory.id);
  }

  expanded(directory: BookmarkDirectory) {
    return this.bookmarkService.isDirectoryExpanded(directory.id);
  }

  isVisible(directory: BookmarkDirectory) {
    return directory && !directory.url;
  }

  open(directory: BookmarkDirectory) {
    const component = this.menuComponent;
    if (component != null) {
      component.folder = directory;
    }
    this.bookmarkService.selectDirectory(directory);
  }

  onRightClick(event: MouseEvent, directory: BookmarkDirectory) {
    this.bookmarkService.selectDirectory(directory);
  }

  hasSubDirectories(directory: chrome.bookmarks.BookmarkTreeNode) {
    return directory?.children?.some((child) => (child as any).hasOwnProperty('children')) ?? false;
  }
}

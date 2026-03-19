import { ChangeDetectorRef, Component, inject, Input, SimpleChanges, ViewChild } from '@angular/core';

import { ContextMenuComponent } from "../context-menu/context-menu.component";
import { ContextMenuGroupDirective } from "../context-menu/context-menu-group.component";
import { ContextMenuItemComponent } from "../context-menu/context-menu-item.component";
import { Icons } from '../../../shared/icons';
import { Router } from "@angular/router";
import {BookmarksService} from "../../../services/chrome/bookmarks/bookmarks.service";
import { SelectionService } from '../../../services';

@Component({
  selector: 'app-folder-menu',
  standalone: true,
  imports: [ContextMenuComponent, ContextMenuGroupDirective, ContextMenuItemComponent],
  templateUrl: './folder-menu.component.html',
  styleUrl: './folder-menu.component.scss'
})
export class FolderMenuComponent {
  Icons = Icons;

  @Input() public folder: any | null = null;

  @ViewChild('menu', { static: true })
  menu!: ContextMenuComponent;

  private bookmarksService = inject(BookmarksService);
  private selectionService = inject(SelectionService);

  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.cdr.detectChanges(); // this is needed to re-render deeply nested menu items
  }

  openInNewTab() {
    window.open(this.getUrl(), "_blank");
  }

  openInNewWindow() {
    window.open(this.getUrl(), "_blank");
  }

  createNewFolder() {
     const name = prompt("Enter folder name");
     if (name) {
         this.bookmarksService.create({
             parentId: this.folder.id,
             title: name
         });
     }
  }

  createNewBookmark() {
     const name = prompt("Enter bookmark name");
     const url = prompt("Enter bookmark URL", "https://");
     if (name && url) {
         this.bookmarksService.create({
             parentId: this.folder.id,
             title: name,
             url: url
         });
     }
  }

  public async deleteSelectedFolder() {
    const folder = this.folder;
    if (!folder) {
      return;
    }

    if (this.isProtectedFolder(folder)) {
      alert('This folder cannot be deleted from the sidebar.');
      return;
    }

    if ((folder.children?.length ?? 0) > 0) {
      alert('Only empty folders can be deleted from the sidebar.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${folder.title}"?`)) {
      return;
    }

    await new Promise(resolve => window.setTimeout(resolve, 0));
    await this.bookmarksService.remove(folder.id);
    this.selectionService.clearDirectorySelection();
  }

  private getUrl() {
    return this.folder?.url;
  }

  private isProtectedFolder(folder: chrome.bookmarks.BookmarkTreeNode) {
    return !!folder.url
      || !folder.parentId
      || folder.parentId === '0'
      || folder.id.startsWith('ROOT_')
      || folder.id.startsWith('TAG_')
      || folder.id.startsWith('SERVER_');
  }
}

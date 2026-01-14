import { Component, inject, Input, ViewChild } from '@angular/core';

import {CdkMenu, CdkMenuItem, CdkMenuTrigger} from "@angular/cdk/menu";
import {ContextMenuComponent} from "../context-menu/context-menu.component";
import {ContextMenuGroupDirective} from "../context-menu/context-menu-group.component";
import {ContextMenuItemComponent} from "../context-menu/context-menu-item.component";
import {Icons} from "../../../shared/icons";
import {BookmarksService} from "../../../services/chrome/bookmarks/bookmarks.service";

@Component({
  selector: 'app-bookmark-menu',
  standalone: true,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, ContextMenuComponent, ContextMenuGroupDirective, ContextMenuItemComponent],
  templateUrl: './bookmark-menu.component.html',
  styleUrl: './bookmark-menu.component.css'
})
export class BookmarkMenuComponent {
  Icons = Icons;

  @Input() bookmark: chrome.bookmarks.BookmarkTreeNode | null = null;
  @ViewChild('menu', { static: true }) menu!: ContextMenuComponent;

  private bookmarksService = inject(BookmarksService);

  openInNewTab() {
    if (this.bookmark?.url) {
      window.open(this.bookmark.url, "_blank");
    }
  }

  openInNewWindow() {
    if (this.bookmark?.url) {
      window.open(this.bookmark.url, "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,width=800,height=600");
    }
  }
  
  delete() {
    if (this.bookmark?.id) {
      this.bookmarksService.remove(this.bookmark.id);
    }
  }
}

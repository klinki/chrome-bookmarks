import { ChangeDetectorRef, Component, inject, Input, SimpleChanges, ViewChild } from '@angular/core';

import { ContextMenuComponent } from "../context-menu/context-menu.component";
import { ContextMenuGroupDirective } from "../context-menu/context-menu-group.component";
import { ContextMenuItemComponent } from "../context-menu/context-menu-item.component";
import { Icons } from '../../../shared/icons';
import { Router } from "@angular/router";
import {BookmarksService} from "../../../services/chrome/bookmarks/bookmarks.service";

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

  private getUrl() {
    return this.folder?.url;
  }
}
